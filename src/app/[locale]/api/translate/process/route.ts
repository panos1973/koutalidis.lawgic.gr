import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { NextRequest } from 'next/server'
import db from '@/db/drizzle'
import { translationJobs, translations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import PizZip from 'pizzip'

type LangCode = 'el' | 'en' | 'fr'

const LANG_NAMES: Record<LangCode, string> = {
  el: 'Greek',
  en: 'English',
  fr: 'French',
}

interface TermMatchInput {
  sourceTerm: string
  targetTerm: string
  alternatives: Array<{ term: string; status: string }>
  domains: string[]
  reliability?: string
}

/**
 * POST /api/translate/process
 *
 * The workhorse: processes translation batches in a loop, saving progress
 * to the database after each batch. Self-chains when approaching the
 * function timeout to continue processing.
 */
export const maxDuration = 300

const MAX_CONSECUTIVE_FAILURES = 3
// Leave 30s buffer before Vercel timeout
const SAFE_EXECUTION_MS = (maxDuration - 30) * 1000

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const { jobId } = body as { jobId: string }

    if (!jobId) {
      return Response.json({ error: 'jobId is required' }, { status: 400 })
    }

    // Load job from DB
    const [job] = await db
      .select()
      .from(translationJobs)
      .where(eq(translationJobs.id, jobId))
      .limit(1)

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    // Skip if already done or failed
    if (job.status === 'completed' || job.status === 'failed') {
      return Response.json({ status: job.status, message: 'Job already finished' })
    }

    const paragraphs = job.paragraphs as string[]
    const batchRanges = job.batchRanges as Array<[number, number]>
    const domain = job.domain as { primaryDomain: string; secondaryDomain: string | null }
    const terminology = (job.terminology ?? []) as TermMatchInput[]
    const totalBatches = job.totalBatches ?? batchRanges.length
    let completedBatches = job.completedBatches
    let translatedParagraphs = (job.translatedParagraphs ?? []) as string[]

    // Ensure translatedParagraphs array is the right size
    if (translatedParagraphs.length < paragraphs.length) {
      translatedParagraphs = [
        ...translatedParagraphs,
        ...new Array(paragraphs.length - translatedParagraphs.length).fill(''),
      ]
    }

    const srcName = LANG_NAMES[job.sourceLang as LangCode]
    const tgtName = LANG_NAMES[job.targetLang as LangCode]
    const domainInfo = domain?.secondaryDomain
      ? `${domain.primaryDomain} and ${domain.secondaryDomain}`
      : (domain?.primaryDomain ?? 'legal')

    // Update lastActivityAt to claim this job
    await db
      .update(translationJobs)
      .set({ lastActivityAt: new Date(), status: 'translating' })
      .where(eq(translationJobs.id, jobId))

    let consecutiveFailures = 0

    // Process remaining batches
    for (let batchIdx = completedBatches; batchIdx < totalBatches; batchIdx++) {
      // Check if we're running out of time
      const elapsed = Date.now() - startTime
      if (elapsed > SAFE_EXECUTION_MS) {
        console.log(
          `[Translation Process] Job ${jobId}: time limit approaching (${elapsed}ms), ` +
            `self-chaining after batch ${batchIdx}/${totalBatches}`,
        )
        // Self-chain to continue
        triggerSelfChain(req, jobId)
        return Response.json({
          status: 'continuing',
          completedBatches: batchIdx,
          totalBatches,
        })
      }

      const [rangeStart, rangeEnd] = batchRanges[batchIdx]
      const batchTexts = paragraphs.slice(rangeStart, rangeEnd)

      try {
        console.log(
          `[Translation Process] Job ${jobId}: batch ${batchIdx + 1}/${totalBatches} ` +
            `(${batchTexts.length} paragraphs)`,
        )

        const batchTranslations = await translateParagraphBatch(
          batchTexts,
          srcName,
          tgtName,
          domainInfo,
          terminology,
        )

        // Fill in translated paragraphs
        for (let i = 0; i < batchTranslations.length; i++) {
          translatedParagraphs[rangeStart + i] = batchTranslations[i]
        }

        completedBatches = batchIdx + 1
        consecutiveFailures = 0

        // Checkpoint: save progress to DB after each batch
        await db
          .update(translationJobs)
          .set({
            completedBatches,
            translatedParagraphs,
            lastActivityAt: new Date(),
          })
          .where(eq(translationJobs.id, jobId))
      } catch (err) {
        consecutiveFailures++
        console.error(
          `[Translation Process] Job ${jobId}: batch ${batchIdx + 1} failed ` +
            `(attempt ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
          err,
        )

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          const errorMsg =
            err instanceof Error
              ? err.message
              : `Failed after ${MAX_CONSECUTIVE_FAILURES} consecutive batch failures`
          await db
            .update(translationJobs)
            .set({
              status: 'failed',
              errorMessage: errorMsg,
              lastActivityAt: new Date(),
            })
            .where(eq(translationJobs.id, jobId))

          return Response.json({ status: 'failed', error: errorMsg })
        }

        // Retry this batch by not incrementing batchIdx
        // The for loop will naturally move on, so we adjust
        // Actually we want to retry the same batch, so we decrement
        // No — better to continue to next batch and note the failure
        // The translation will have an empty paragraph for this batch
        // which is better than blocking the whole job
        completedBatches = batchIdx + 1
        await db
          .update(translationJobs)
          .set({
            completedBatches,
            translatedParagraphs,
            retryCount: job.retryCount + consecutiveFailures,
            lastActivityAt: new Date(),
          })
          .where(eq(translationJobs.id, jobId))
      }
    }

    // All batches done — finalize
    console.log(`[Translation Process] Job ${jobId}: all ${totalBatches} batches complete, finalizing...`)

    const translatedText = translatedParagraphs
      .filter((t) => t && t.trim().length > 0)
      .join('\n\n')

    let translatedDocxBase64: string | null = null

    // If DOCX mode, rebuild the document
    if (job.isDocx && job.docxBase64) {
      try {
        await db
          .update(translationJobs)
          .set({ status: 'building', lastActivityAt: new Date() })
          .where(eq(translationJobs.id, jobId))

        translatedDocxBase64 = buildTranslatedDocx(
          job.docxBase64,
          paragraphs,
          translatedParagraphs,
        )
      } catch (err) {
        console.error(`[Translation Process] Job ${jobId}: DOCX build failed:`, err)
        // Continue — text result is still available
      }
    }

    // Save to translations history table
    const srcLangName = LANG_NAMES[job.sourceLang as LangCode] ?? job.sourceLang
    const tgtLangName = LANG_NAMES[job.targetLang as LangCode] ?? job.targetLang
    const title = job.isDocx && job.docxFileName
      ? `${job.docxFileName} (${srcLangName} → ${tgtLangName})`
      : `${srcLangName} → ${tgtLangName}`

    let translationId: string | null = null
    try {
      const [historyRow] = await db
        .insert(translations)
        .values({
          title,
          sourceLang: job.sourceLang,
          targetLang: job.targetLang,
          domain: [domain.primaryDomain, domain.secondaryDomain].filter(Boolean).join(', '),
          paragraphCount: paragraphs.length,
          sourcePreview: (job.isDocx ? paragraphs.slice(0, 3).join(' ') : (job.sourceText ?? '')).slice(0, 200),
          translatedPreview: translatedText.slice(0, 200),
          sourceText: job.isDocx ? null : (job.sourceText ?? null),
          translatedText: job.isDocx ? null : translatedText,
          userId: job.userId,
        })
        .returning({ id: translations.id })
      translationId = historyRow.id
    } catch (err) {
      console.error(`[Translation Process] Job ${jobId}: failed to save history:`, err)
    }

    // Mark job complete
    await db
      .update(translationJobs)
      .set({
        status: 'completed',
        translatedText,
        translatedDocxBase64,
        translationId,
        completedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(translationJobs.id, jobId))

    console.log(`[Translation Process] Job ${jobId}: completed successfully`)

    return Response.json({
      status: 'completed',
      completedBatches: totalBatches,
      totalBatches,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Processing failed'
    console.error('[translate/process]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

// ─── Translation Logic (reused from batch route) ────────────────────

async function translateParagraphBatch(
  texts: string[],
  srcName: string,
  tgtName: string,
  domainInfo: string,
  terminology: TermMatchInput[],
): Promise<string[]> {
  const MAX_RETRIES = 2
  const RETRY_DELAYS = [3000, 6000]

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await doTranslate(texts, srcName, tgtName, domainInfo, terminology)
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[Translation Process] Batch failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`,
        )
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
        continue
      }
      throw err
    }
  }

  throw new Error('Unreachable')
}

async function doTranslate(
  texts: string[],
  srcName: string,
  tgtName: string,
  domainInfo: string,
  terminology: TermMatchInput[],
): Promise<string[]> {
  const numberedSource = texts
    .map((text, i) => `[${i + 1}] ${text}`)
    .join('\n')

  const systemPrompt = `You are a professional legal translator specializing in ${srcName} to ${tgtName} translation for ${domainInfo} documents.

Rules:
1. Translate each numbered paragraph EXACTLY, preserving the numbering format [N]
2. Return EXACTLY ${texts.length} numbered paragraphs — one translation per source paragraph
3. Maintain all legal precision, terminology, and meaning
4. Preserve proper nouns, entity names, dates, reference numbers, and legal citations
5. Use formal legal register appropriate for official ${domainInfo} documents
6. Keep the same paragraph structure — if the source has one paragraph, the translation is one paragraph
7. Do NOT merge or split paragraphs
8. Do NOT add explanations or notes — return ONLY the numbered translations
9. CRITICAL FORMATTING RULE: Reproduce the exact layout and structure of the source text. If numbered items (Roman numerals like I., II., III., IV., or Arabic numerals like 1., 2., 3., or letters like a., b.) appear on the same line as their associated text in the source, they MUST remain on the same line in the translation.
10. When approved terminology is provided below, you MUST use those translations for the specified terms. Prefer "preferred" status terms over "admitted" alternatives.`

  const terminologySection = buildTerminologySection(terminology)

  const userMessage = terminologySection
    ? `${terminologySection}\n\n## Source Paragraphs (${srcName})\n${numberedSource}\n\n## Instructions\nTranslate each numbered paragraph above to ${tgtName}. Use the approved terminology when the terms appear. Return in format:\n[1] translation of paragraph 1\n[2] translation of paragraph 2\n...`
    : `## Source Paragraphs (${srcName})\n${numberedSource}\n\n## Instructions\nTranslate each numbered paragraph above to ${tgtName}. Return in format:\n[1] translation of paragraph 1\n[2] translation of paragraph 2\n...`

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0)
  const maxTokens = Math.max(2048, Math.min(totalChars * 2, 16384))

  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.2,
    maxTokens,
  })

  return parseNumberedTranslations(result.text, texts.length)
}

function buildTerminologySection(terminology: TermMatchInput[]): string {
  if (!terminology || terminology.length === 0) return ''

  const lines = terminology.map((t) => {
    const preferred = t.alternatives.find((a) => a.status === 'preferred')
    const others = t.alternatives
      .filter((a) => a.status !== 'preferred' && a.term !== t.targetTerm)
      .map((a) => `"${a.term}" (${a.status})`)
      .join(' | ')

    const domainTag =
      t.domains.length > 0 ? ` [${t.domains.join(', ')}]` : ''

    let line = `- "${t.sourceTerm}" → "${preferred?.term ?? t.targetTerm}" (preferred)`
    if (others) {
      line += ` | ${others}`
    }
    line += domainTag

    return line
  })

  return `## Approved Terminology\nUse these translations when the terms appear:\n${lines.join('\n')}`
}

function parseNumberedTranslations(
  response: string,
  expectedCount: number,
): string[] {
  const translationsArr: string[] = new Array(expectedCount).fill('')

  const regex = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g
  const matches = response.matchAll(regex)

  for (const m of matches) {
    const idx = Number.parseInt(m[1], 10) - 1
    const text = m[2].trim()
    if (idx >= 0 && idx < expectedCount) {
      translationsArr[idx] = text
    }
  }

  return translationsArr
}

// ─── DOCX Rebuild Logic (reused from docx-translate route) ──────────

function buildTranslatedDocx(
  docxBase64: string,
  originalParagraphs: string[],
  translatedParagraphs: string[],
): string {
  const binaryContent = Buffer.from(docxBase64, 'base64')
  const zip = new PizZip(binaryContent)

  const paragraphMap = originalParagraphs.map((original, i) => ({
    original,
    translated: translatedParagraphs[i] || original,
  }))

  const xmlFiles = Object.keys(zip.files).filter(
    (name) =>
      name === 'word/document.xml' ||
      name.match(/^word\/header\d*\.xml$/) ||
      name.match(/^word\/footer\d*\.xml$/),
  )

  for (const xmlFileName of xmlFiles) {
    const xmlFile = zip.file(xmlFileName)
    if (!xmlFile) continue

    let xml = xmlFile.asText()
    xml = replaceTranslations(xml, paragraphMap)
    zip.file(xmlFileName, xml)
  }

  const updatedBuffer = zip.generate({
    type: 'nodebuffer',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  return updatedBuffer.toString('base64')
}

function replaceTranslations(
  xml: string,
  paragraphMap: Array<{ original: string; translated: string }>,
): string {
  const lookup = new Map<string, string>()
  for (const entry of paragraphMap) {
    const key = normalizeText(entry.original)
    if (key && entry.translated.trim()) {
      lookup.set(key, entry.translated)
    }
  }

  if (lookup.size === 0) return xml

  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const textParts: string[] = []
    paragraphXml.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_match, text) => {
      textParts.push(text)
      return _match
    })

    const combinedText = textParts.join('')
    const normalizedCombined = normalizeText(combinedText)

    if (!normalizedCombined || !lookup.has(normalizedCombined)) {
      return paragraphXml
    }

    const translation = lookup.get(normalizedCombined)!

    let isFirst = true
    const replaced = paragraphXml.replace(
      /<w:t([^>]*)>([^<]*)<\/w:t>/g,
      (_match, attrs) => {
        if (isFirst) {
          isFirst = false
          const spaceAttr = attrs.includes('xml:space')
            ? attrs
            : ` xml:space="preserve"${attrs}`
          return `<w:t${spaceAttr}>${escapeXml(translation)}</w:t>`
        }
        return `<w:t${attrs}></w:t>`
      },
    )

    return replaced
  })
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ─── Self-Chain Helper ──────────────────────────────────────────────

function triggerSelfChain(req: NextRequest, jobId: string) {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || req.headers.get('x-forwarded-host')
  let baseUrl: string
  if (host) {
    baseUrl = `${proto}://${host}`
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  } else {
    baseUrl = 'http://localhost:3000'
  }

  const locale = req.url.match(/\/(el|en|fr)\//)?.[1] || 'en'

  fetch(`${baseUrl}/${locale}/api/translate/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.CRON_SECRET || 'internal',
    },
    body: JSON.stringify({ jobId }),
  }).catch((err) => {
    console.error(`[Translation Process] Self-chain failed for job ${jobId}:`, err)
  })
}
