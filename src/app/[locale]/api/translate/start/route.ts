import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { detectLegalDomain } from '@/lib/translate/detect-legal-domain'
import {
  searchTerminology,
  type TermMatch,
} from '@/lib/translate/tm-search'
import db from '@/db/drizzle'
import { translationJobs } from '@/db/schema'

const MAX_PARAGRAPHS_PER_BATCH = 15
const MAX_CHARS_PER_BATCH = 6000

/**
 * POST /api/translate/start
 *
 * Creates a translation job, runs the prepare phase (domain detection +
 * terminology search), stores everything in the DB, and fires off the
 * first processing call. Returns { jobId } immediately so the client
 * can start polling.
 */
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      sourceText,
      sourceLang,
      targetLang,
      isDocx,
      docxBase64,
      docxFileName,
      paragraphs: docxParagraphs,
    } = body as {
      sourceText?: string
      sourceLang: string
      targetLang: string
      isDocx?: boolean
      docxBase64?: string
      docxFileName?: string
      paragraphs?: string[]
    }

    // Validate languages
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

    // Determine paragraphs based on mode
    let paragraphs: string[]
    if (isDocx && docxParagraphs && docxParagraphs.length > 0) {
      paragraphs = docxParagraphs
    } else if (sourceText && sourceText.trim()) {
      paragraphs = sourceText
        .split(/\n{2,}/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
    } else {
      return Response.json({ error: 'No content provided' }, { status: 400 })
    }

    if (paragraphs.length === 0) {
      return Response.json({ error: 'No text content found' }, { status: 400 })
    }

    // Run prepare phase: domain detection + terminology search
    const fullText = paragraphs.join('\n\n')
    const [domain, terminology] = await Promise.all([
      detectLegalDomain(fullText).catch((err) => {
        console.error('[Translation Start] Domain detection failed:', err)
        return {
          primaryDomain: 'legal' as const,
          secondaryDomain: null,
          confidence: 'low' as const,
        }
      }),
      searchTerminology(
        fullText,
        sourceLang as 'el' | 'en' | 'fr',
        targetLang as 'el' | 'en' | 'fr',
        undefined,
        50,
      ).catch((err) => {
        console.error('[Translation Start] Terminology search failed:', err)
        return [] as TermMatch[]
      }),
    ])

    // Re-rank terminology by domain
    const rankedTerminology = rankTerminologyByDomain(
      terminology,
      domain.primaryDomain,
      domain.secondaryDomain,
    )

    // Compute batch ranges
    const batchRanges: Array<[number, number]> = []
    let start = 0
    while (start < paragraphs.length) {
      let end = start
      let charCount = 0
      while (end < paragraphs.length) {
        const nextChars = charCount + paragraphs[end].length
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
      `[Translation Start] Creating job: ${paragraphs.length} paragraphs, ${totalBatches} batches, ` +
        `domain: ${domain.primaryDomain}, terminology: ${rankedTerminology.length} terms, ` +
        `mode: ${isDocx ? 'docx' : 'text'}`,
    )

    // Insert job into database
    const [job] = await db
      .insert(translationJobs)
      .values({
        userId,
        status: 'translating',
        sourceText: isDocx ? null : (sourceText ?? null),
        sourceLang,
        targetLang,
        isDocx: isDocx ?? false,
        docxBase64: isDocx ? (docxBase64 ?? null) : null,
        docxFileName: isDocx ? (docxFileName ?? null) : null,
        paragraphs,
        domain,
        terminology: rankedTerminology,
        batchRanges,
        totalBatches,
        completedBatches: 0,
        translatedParagraphs: [],
      })
      .returning({ id: translationJobs.id })

    const jobId = job.id

    // Fire-and-forget: trigger processing
    const baseUrl = getBaseUrl(req)
    const locale = extractLocale(req.url)
    fetch(`${baseUrl}/${locale}/api/translate/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.CRON_SECRET || 'internal',
      },
      body: JSON.stringify({ jobId }),
    }).catch((err) => {
      console.error('[Translation Start] Failed to trigger processing:', err)
    })

    return Response.json({ jobId })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to start translation'
    console.error('[translate/start]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

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

function getBaseUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || req.headers.get('x-forwarded-host')
  if (host) return `${proto}://${host}`
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function extractLocale(url: string): string {
  const match = url.match(/\/(el|en|fr)\//)
  return match ? match[1] : 'en'
}
