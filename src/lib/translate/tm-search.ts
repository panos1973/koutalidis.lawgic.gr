import {
  type LangCode,
  getCollectionForPair,
  queryWeaviateNearVector,
} from './weaviate-client'
import { embedTexts } from './embed'
import { splitLegalSentences } from './split-sentences'
import db from '@/db/drizzle'
import { terminology as terminologyTable } from '@/db/schema_translate'

// ──────────────────────────────────────────────
//  Public types
// ──────────────────────────────────────────────

export interface TMMatch {
  textSrc: string
  textTgt: string
  langSrc: string
  langTgt: string
  sourceCorpus: string
  distance: number
  /** 0–100 similarity percentage (1 − distance) × 100 */
  similarity: number
}

export interface TermMatch {
  sourceTerm: string
  /** Preferred target term (first in the DB, or highest status) */
  targetTerm: string
  /** All available target translations with their status */
  alternatives: Array<{ term: string; status: string }>
  /** All domains for this concept (e.g. ["civil law", "contract law"]) */
  domains: string[]
  reliability?: string
}

export interface TranslationContext {
  /** TM matches grouped by source sentence index */
  tmMatches: TMMatch[][]
  /** Terminology matches found across the whole text */
  termMatches: TermMatch[]
}

// ──────────────────────────────────────────────
//  Core TM search
// ──────────────────────────────────────────────

/**
 * Batch TM search: embeds ALL sentences in a single Voyage API call,
 * then queries Weaviate concurrently with the pre-computed vectors.
 *
 * Returns TMMatch[][] indexed by sentence position.
 */
export async function searchTMBatch(
  sentences: string[],
  sourceLang: LangCode,
  targetLang: LangCode,
  limit = 3,
): Promise<TMMatch[][]> {
  if (sentences.length === 0) return []

  const collectionName = getCollectionForPair(sourceLang, targetLang)
  if (!collectionName) {
    console.warn(
      `[TM Search] No collection found for pair ${sourceLang}→${targetLang}`,
    )
    return sentences.map(() => [])
  }

  // Check if Voyage AI is configured
  if (!process.env.VOYAGE_API_KEY) {
    console.warn(
      '[TM Search] VOYAGE_API_KEY not configured — skipping TM search',
    )
    return sentences.map(() => [])
  }

  // Embed ALL sentences in one API call
  console.log(
    `[TM Search] Batch-embedding ${sentences.length} sentences via Voyage AI…`,
  )
  const vectors = await embedTexts(sentences)
  console.log(
    `[TM Search] Got ${vectors.length} vectors (${vectors[0]?.length ?? 0} dims)`,
  )

  // Query Weaviate concurrently (max 10 concurrent)
  console.log(
    `[TM Search] Querying "${collectionName}" for ${vectors.length} vectors…`,
  )
  const tmResults = await processConcurrently(
    vectors,
    async (vector) => {
      const results = await queryWeaviateNearVector(
        vector,
        collectionName,
        sourceLang,
        targetLang,
        limit,
      )
      return results.map((r) => ({
        ...r,
        similarity: Math.round((1 - r.distance) * 100),
      }))
    },
    10,
  )

  const totalMatches = tmResults.reduce((sum, arr) => sum + arr.length, 0)
  console.log(
    `[TM Search] Batch complete: ${totalMatches} matches across ${sentences.length} sentences`,
  )

  return tmResults
}

// ──────────────────────────────────────────────
//  Terminology search (with in-memory cache)
// ──────────────────────────────────────────────

/** Module-level cache for terminology rows. TTL: 5 minutes. */
type TerminologyRow = typeof terminologyTable.$inferSelect
let _termCache: { rows: TerminologyRow[]; ts: number } | null = null
const TERM_CACHE_TTL_MS = 5 * 60 * 1000

async function getTerminologyRows(): Promise<TerminologyRow[]> {
  const now = Date.now()
  if (_termCache && now - _termCache.ts < TERM_CACHE_TTL_MS) {
    return _termCache.rows
  }
  // Load ALL rows (table is typically < 10k) so we don't miss matches
  const rows = await db.select().from(terminologyTable)
  _termCache = { rows, ts: now }
  return rows
}

/**
 * Searches terminology from Postgres (cached in-memory, 5 min TTL).
 *
 * Uses whole-word matching to avoid false positives on partial words.
 * Prioritizes terms whose domains match the detected legal domain.
 */
export async function searchTerminology(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  detectedDomain?: string,
  limit = 50,
): Promise<TermMatch[]> {
  try {
    console.log(
      `[Terminology] Searching for ${sourceLang}→${targetLang} terms…`,
    )

    const termRows = await getTerminologyRows()
    console.log(`[Terminology] Loaded ${termRows.length} rows from PostgreSQL (cached=${_termCache !== null && Date.now() - _termCache.ts < TERM_CACHE_TTL_MS})`)

    const lowerText = text.toLowerCase()
    const textPreview = text.slice(0, 200).replace(/\n/g, ' ')
    console.log(`[Terminology] Input text preview: "${textPreview}…"`)

    // Count how many rows have terms for this language pair
    let rowsWithPair = 0
    for (const row of termRows) {
      if (!row.terms) continue
      const src = row.terms[sourceLang as keyof typeof row.terms] ?? []
      const tgt = row.terms[targetLang as keyof typeof row.terms] ?? []
      if (src.length > 0 && tgt.length > 0) rowsWithPair++
    }
    console.log(`[Terminology] ${rowsWithPair} rows have terms for ${sourceLang}→${targetLang} pair`)
    const domainMatches: TermMatch[] = []
    const otherMatches: TermMatch[] = []

    for (const row of termRows) {
      if (!row.terms) continue

      const srcTerms = row.terms[sourceLang as keyof typeof row.terms] ?? []
      const tgtTerms = row.terms[targetLang as keyof typeof row.terms] ?? []

      if (srcTerms.length === 0 || tgtTerms.length === 0) continue

      // Check if any source term appears in the input text (whole-word match).
      // For Greek text, \b doesn't work on Unicode, so we use a lookaround
      // pattern that matches word edges via non-letter characters or string edges.
      const matchedSrc = srcTerms.find((t: { term: string }) => {
        const escaped = t.term
          .toLowerCase()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(
          `(?<=^|[\\s,.;:!?()\\[\\]"'«»—–\\-/])${escaped}(?=$|[\\s,.;:!?()\\[\\]"'«»—–\\-/])`,
          'i',
        )
        return pattern.test(lowerText)
      })
      if (!matchedSrc) continue

      const match: TermMatch = {
        sourceTerm: matchedSrc.term,
        targetTerm: tgtTerms[0].term,
        alternatives: tgtTerms.map((t: { term: string; status: string }) => ({
          term: t.term,
          status: t.status,
        })),
        domains: row.domains ?? [],
        reliability: row.reliability ?? undefined,
      }

      // Prioritize terms that match the detected legal domain
      const matchesDomain =
        detectedDomain &&
        (row.domains ?? []).some(
          (d) =>
            d.toLowerCase().includes(detectedDomain.toLowerCase()) ||
            detectedDomain.toLowerCase().includes(d.toLowerCase()),
        )

      if (matchesDomain) {
        domainMatches.push(match)
      } else {
        otherMatches.push(match)
      }
    }

    // Return domain-matching terms first, then others, up to limit
    const combined = [...domainMatches, ...otherMatches].slice(0, limit)

    console.log(
      `[Terminology] Found ${combined.length} matching terms (${domainMatches.length} domain-specific, ${otherMatches.length} general)`,
    )

    // Log each matched term with its translation
    if (combined.length > 0) {
      console.log(`[Terminology] ── Matched terms (${sourceLang}→${targetLang}) ──`)
      for (const t of combined) {
        const preferred = t.alternatives.find((a) => a.status === 'preferred')
        const domainTag = t.domains.length > 0 ? ` [${t.domains.slice(0, 3).join(', ')}]` : ''
        console.log(
          `[Terminology]   "${t.sourceTerm}" → "${preferred?.term ?? t.targetTerm}" (${preferred ? 'preferred' : 'first-available'})${domainTag}`,
        )
      }
      console.log(`[Terminology] ── End of matched terms ──`)
    }

    return combined
  } catch (err) {
    console.error('[Terminology] Error:', err)
    return []
  }
}

// ──────────────────────────────────────────────
//  Orchestrator
// ──────────────────────────────────────────────

/**
 * Splits text into sentences, retrieves TM matches for each,
 * and fetches relevant terminology for the full text.
 *
 * Runs TM search + terminology search in parallel.
 */
export async function retrieveTranslationContext(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  detectedDomain?: string,
  matchesPerSentence = 3,
): Promise<{ sentences: string[]; context: TranslationContext }> {
  const sentences = splitLegalSentences(text)

  console.log(
    `[TM Orchestrator] Split text into ${sentences.length} sentences for ${sourceLang}→${targetLang}`,
  )

  // Run TM batch search + terminology search in parallel
  // Both are wrapped so failures degrade gracefully
  const [tmResults, termMatches] = await Promise.all([
    searchTMBatch(sentences, sourceLang, targetLang, matchesPerSentence).catch(
      (err) => {
        console.error(
          '[TM Orchestrator] TM search failed, continuing without TM matches:',
          err,
        )
        return sentences.map(() => [] as TMMatch[])
      },
    ),
    searchTerminology(text, sourceLang, targetLang, detectedDomain).catch(
      (err) => {
        console.error(
          '[TM Orchestrator] Terminology search failed, continuing without terminology:',
          err,
        )
        return [] as TermMatch[]
      },
    ),
  ])

  // Summary log
  const totalMatches = tmResults.reduce((sum, arr) => sum + arr.length, 0)
  const sentencesWithMatches = tmResults.filter((arr) => arr.length > 0).length
  console.log(
    `[TM Orchestrator] Results: ${totalMatches} total TM matches across ${sentencesWithMatches}/${sentences.length} sentences, ${termMatches.length} terminology matches`,
  )

  return {
    sentences,
    context: {
      tmMatches: tmResults,
      termMatches,
    },
  }
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

async function processConcurrently<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  maxConcurrent: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0

  const worker = async () => {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}
