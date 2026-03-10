import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { detectLegalDomain } from '@/lib/translate/detect-legal-domain'
import { splitLegalSentences } from '@/lib/translate/split-sentences'

/** Max paragraphs per batch — must match what the client uses to slice */
const BATCH_SIZE = 20

/**
 * POST /api/translate/prepare
 *
 * Phase 1 of batch translation.
 * Splits text into paragraphs, detects legal domain.
 * Returns paragraph list + batch count so the client can
 * orchestrate per-batch translation calls.
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

    // Detect legal domain from the full text
    const domain = await detectLegalDomain(content).catch((err) => {
      console.error('[Translation Prepare] Domain detection failed:', err)
      return {
        primaryDomain: 'legal' as const,
        secondaryDomain: null,
        confidence: 'low' as const,
      }
    })

    const totalBatches = Math.ceil(rawParagraphs.length / BATCH_SIZE)

    console.log(
      `[Translation Prepare] ${rawParagraphs.length} paragraphs, ${totalBatches} batch(es), domain: ${domain.primaryDomain}`,
    )

    return Response.json({
      paragraphs: rawParagraphs,
      domain,
      totalBatches,
      batchSize: BATCH_SIZE,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Preparation failed'
    console.error('[translate/prepare]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}
