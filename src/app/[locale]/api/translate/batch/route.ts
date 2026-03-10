import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'

type LangCode = 'el' | 'en' | 'fr'

const VALID_LANGS: LangCode[] = ['el', 'en', 'fr']

const LANG_NAMES: Record<LangCode, string> = {
  el: 'Greek',
  en: 'English',
  fr: 'French',
}

/**
 * POST /api/translate/batch
 *
 * Phase 2 of batch translation.
 * Translates a single batch of paragraph texts using Claude.
 * Called once per batch by the client — each call completes well within
 * Vercel's function timeout (even for very large documents).
 */
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { texts, sourceLang, targetLang, domain, subscriptionId } = body

    if (!Array.isArray(texts) || texts.length === 0) {
      return Response.json(
        { error: 'texts array is required' },
        { status: 400 },
      )
    }

    if (
      !VALID_LANGS.includes(sourceLang) ||
      !VALID_LANGS.includes(targetLang)
    ) {
      return Response.json(
        { error: `Invalid language. Supported: ${VALID_LANGS.join(', ')}` },
        { status: 400 },
      )
    }

    const srcName = LANG_NAMES[sourceLang as LangCode]
    const tgtName = LANG_NAMES[targetLang as LangCode]
    const domainInfo = domain?.secondaryDomain
      ? `${domain.primaryDomain} and ${domain.secondaryDomain}`
      : (domain?.primaryDomain ?? 'legal')

    const translations = await translateParagraphBatch(
      texts,
      srcName,
      tgtName,
      domainInfo,
    )

    // Track usage
    if (subscriptionId) {
      await recordMessageUsage(subscriptionId).catch(() => {})
    }

    return Response.json({ translations })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Batch translation failed'
    console.error('[translate/batch]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

async function translateParagraphBatch(
  texts: string[],
  srcName: string,
  tgtName: string,
  domainInfo: string,
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
9. CRITICAL FORMATTING RULE: Reproduce the exact layout and structure of the source text. If numbered items (Roman numerals like I., II., III., IV., or Arabic numerals like 1., 2., 3., or letters like a., b.) appear on the same line as their associated text in the source, they MUST remain on the same line in the translation.`

  const userMessage = `## Source Paragraphs (${srcName})
${numberedSource}

## Instructions
Translate each numbered paragraph above to ${tgtName}. Return in format:
[1] translation of paragraph 1
[2] translation of paragraph 2
...`

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

function parseNumberedTranslations(
  response: string,
  expectedCount: number,
): string[] {
  const translations: string[] = new Array(expectedCount).fill('')

  const regex = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g
  const matches = response.matchAll(regex)

  for (const m of matches) {
    const idx = Number.parseInt(m[1], 10) - 1
    const text = m[2].trim()
    if (idx >= 0 && idx < expectedCount) {
      translations[idx] = text
    }
  }

  const filled = translations.filter((t) => t.length > 0).length
  if (filled < expectedCount) {
    console.warn(
      `[Translation] Expected ${expectedCount} translations, got ${filled}`,
    )
  }

  return translations
}
