import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { detectLegalDomain } from '@/lib/translate/detect-legal-domain'
import {
  searchTerminology,
  type TermMatch,
} from '@/lib/translate/tm-search'

/**
 * Adaptive batching: we limit both paragraph count AND total characters
 * per batch to keep each Claude call well within the 300s timeout.
 */
const MAX_PARAGRAPHS_PER_BATCH = 15
const MAX_CHARS_PER_BATCH = 6000

/**
 * POST /api/translate/prepare
 *
 * Phase 1 of batch translation.
 * Splits text into paragraphs, detects legal domain,
 * and retrieves matching terminology from the IATE-based
 * PostgreSQL glossary.
 *
 * Returns paragraph list + batch count + terminology so
 * the client can orchestrate per-batch translation calls.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content, sourceLang, targetLang } = body

    if (!content || typeof content !== 'string' || !content.trim()) {
      return Response.json({ error: 'Content is required' }, { status: 400 })
    }

    const validLangs = ['el', 'en', 'fr']
    if (!validLangs.includes(sourceLang) || !validLangs.includes(targetLang)) {
      return Response.json(
        { error: `Invalid language. Supported: ${validLangs.join(', ')}` },
        { status: 400 },
      )
    }

    if (sourceLang === targetLang) {
      return Response.json(
        { error: 'Source and target language must be different' },
        { status: 400 },
      )
    }

    // Split into paragraphs (by double newline) preserving structure
    const rawParagraphs = content
      .split(/\n{2,}/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0)

    if (rawParagraphs.length === 0) {
      return Response.json(
        { error: 'No text content found' },
        { status: 400 },
      )
    }

    const t0 = Date.now()

    // Detect legal domain + search terminology in parallel
    const [domain, terminology] = await Promise.all([
      detectLegalDomain(content).catch((err) => {
        console.error('[Translation Prepare] Domain detection failed:', err)
        return {
          primaryDomain: 'legal' as const,
          secondaryDomain: null,
          confidence: 'low' as const,
        }
      }),
      searchTerminology(
        content,
        sourceLang as 'el' | 'en' | 'fr',
        targetLang as 'el' | 'en' | 'fr',
        undefined, // domain not yet known at this point
        50,
      ).catch((err) => {
        console.error('[Translation Prepare] Terminology search failed:', err)
        return [] as TermMatch[]
      }),
    ])

    const t1 = Date.now()

    console.log(
      `[Translation Prepare] Domain detected: primary="${domain.primaryDomain}", ` +
        `secondary="${domain.secondaryDomain ?? 'none'}", confidence="${domain.confidence}", ` +
        `elapsed: ${t1 - t0}ms`,
    )
    console.log(
      `[Translation Prepare] Raw terminology from PostgreSQL: ${terminology.length} terms found`,
    )

    // Re-rank terminology: move domain-matching terms to the top
    const rankedTerminology = rankTerminologyByDomain(
      terminology,
      domain.primaryDomain,
      domain.secondaryDomain,
    )

    // Log re-ranking results
    const primaryCount = rankedTerminology.filter((t) =>
      t.domains.some(
        (d) =>
          d.toLowerCase().includes(domain.primaryDomain.toLowerCase()) ||
          domain.primaryDomain.toLowerCase().includes(d.toLowerCase()),
      ),
    ).length
    console.log(
      `[Translation Prepare] Re-ranked terminology: ${primaryCount} domain-matched ("${domain.primaryDomain}"), ` +
        `${rankedTerminology.length - primaryCount} general`,
    )

    // Build adaptive batch ranges based on both paragraph count and character count
    const batchRanges: Array<[number, number]> = []
    let start = 0
    while (start < rawParagraphs.length) {
      let end = start
      let charCount = 0
      while (end < rawParagraphs.length) {
        const nextChars = charCount + rawParagraphs[end].length
        if (end > start && (end - start >= MAX_PARAGRAPHS_PER_BATCH || nextChars > MAX_CHARS_PER_BATCH)) {
          break
        }
        charCount = nextChars
        end++
      }
      batchRanges.push([start, end])
      start = end
    }

    const totalBatches = batchRanges.length

    console.log(
      `[Translation Prepare] ${rawParagraphs.length} paragraphs, ${totalBatches} batch(es), ` +
        `domain: ${domain.primaryDomain}, terminology: ${rankedTerminology.length} terms, ` +
        `elapsed: ${t1 - t0}ms`,
    )

    return Response.json({
      paragraphs: rawParagraphs,
      domain,
      terminology: rankedTerminology,
      totalBatches,
      batchRanges,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Preparation failed'
    console.error('[translate/prepare]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * Re-ranks terminology so domain-matching terms appear first.
 * This ensures the most relevant terms are prioritized when
 * fed into the Claude translation prompt.
 */
function rankTerminologyByDomain(
  terms: TermMatch[],
  primaryDomain: string,
  secondaryDomain: string | null,
): TermMatch[] {
  const primary: TermMatch[] = []
  const secondary: TermMatch[] = []
  const other: TermMatch[] = []

  for (const term of terms) {
    const domainLower = term.domains.map((d) => d.toLowerCase())
    const matchesPrimary = domainLower.some(
      (d) =>
        d.includes(primaryDomain.toLowerCase()) ||
        primaryDomain.toLowerCase().includes(d),
    )
    const matchesSecondary =
      secondaryDomain &&
      domainLower.some(
        (d) =>
          d.includes(secondaryDomain.toLowerCase()) ||
          secondaryDomain.toLowerCase().includes(d),
      )

    if (matchesPrimary) {
      primary.push(term)
    } else if (matchesSecondary) {
      secondary.push(term)
    } else {
      other.push(term)
    }
  }

  return [...primary, ...secondary, ...other]
}
