import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'
import { translationRateLimit, checkRateLimitOrRespond } from '@/lib/rateLimitResponse'

type LangCode = 'el' | 'en' | 'fr'

const VALID_LANGS: LangCode[] = ['el', 'en', 'fr']

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
 * POST /api/translate/batch
 *
 * Phase 2 of batch translation.
 * Translates a single batch of paragraph texts using Claude,
 * now with approved terminology from the IATE legal dictionary
 * stored in PostgreSQL.
 */
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 8 requests/minute per user
    const blocked = checkRateLimitOrRespond(translationRateLimit, userId)
    if (blocked) return blocked

    const body = await req.json()
    const { texts, sourceLang, targetLang, domain, terminology, subscriptionId } = body

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
      terminology ?? [],
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

  // Build the terminology section for the prompt
  const terminologySection = buildTerminologySection(terminology)

  const userMessage = terminologySection
    ? `${terminologySection}\n\n## Source Paragraphs (${srcName})\n${numberedSource}\n\n## Instructions\nTranslate each numbered paragraph above to ${tgtName}. Use the approved terminology when the terms appear. Return in format:\n[1] translation of paragraph 1\n[2] translation of paragraph 2\n...`
    : `## Source Paragraphs (${srcName})\n${numberedSource}\n\n## Instructions\nTranslate each numbered paragraph above to ${tgtName}. Return in format:\n[1] translation of paragraph 1\n[2] translation of paragraph 2\n...`

  const totalChars = texts.reduce((sum, t) => sum + t.length, 0)
  const maxTokens = Math.max(2048, Math.min(totalChars * 2, 16384))

  console.log(
    `[Translation Batch] ${texts.length} paragraphs, ${terminology.length} terms, ` +
      `maxTokens: ${maxTokens}, domain: ${domainInfo}`,
  )

  // Log the terminology section that will be injected into Claude's prompt
  if (terminologySection) {
    const termLines = terminologySection.split('\n').filter((l) => l.startsWith('- '))
    console.log(
      `[Translation Batch] ── Approved Terminology injected into prompt (${termLines.length} terms) ──`,
    )
    for (const line of termLines.slice(0, 20)) {
      console.log(`[Translation Batch]   ${line}`)
    }
    if (termLines.length > 20) {
      console.log(`[Translation Batch]   … and ${termLines.length - 20} more terms`)
    }
    console.log(`[Translation Batch] ── End terminology section ──`)
  } else {
    console.log(`[Translation Batch] No terminology injected (none provided)`)
  }

  // Log prompt size
  const systemChars = systemPrompt.length
  const userChars = userMessage.length
  console.log(
    `[Translation Batch] Prompt sizes: system=${systemChars} chars, user=${userChars} chars (total=${systemChars + userChars} chars)`,
  )

  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.2,
    maxTokens,
  })

  console.log(
    `[Translation Batch] Done — input: ${result.usage?.promptTokens ?? '?'}, ` +
      `output: ${result.usage?.completionTokens ?? '?'}, ` +
      `finish: ${result.finishReason}`,
  )

  return parseNumberedTranslations(result.text, texts.length)
}

/**
 * Builds the "Approved Terminology" section for the Claude prompt.
 * Shows each term with its preferred translation and alternatives.
 */
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
