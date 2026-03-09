import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

export const LEGAL_DOMAINS = [
  'civil law',
  'criminal law',
  'administrative law',
  'commercial law',
  'corporate law',
  'constitutional law',
  'labour law',
  'tax law',
  'environmental law',
  'family law',
  'intellectual property law',
  'maritime law',
  'international law',
  'EU law',
  'data protection law',
  'banking and finance law',
  'insurance law',
  'real estate law',
  'public procurement law',
  'competition law',
] as const

export type LegalDomain = (typeof LEGAL_DOMAINS)[number]

const DomainDetectionSchema = z.object({
  primaryDomain: z
    .string()
    .describe('The primary legal domain of the document'),
  secondaryDomain: z
    .string()
    .nullable()
    .describe('A secondary legal domain if the document spans two areas, or null'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('How confident you are in the classification'),
})

export type DomainDetection = z.infer<typeof DomainDetectionSchema>

/**
 * Detects the legal domain of a document using Claude Haiku.
 * Analyzes the first ~500 words — cost is negligible.
 */
export async function detectLegalDomain(
  text: string,
): Promise<DomainDetection> {
  const excerpt = extractExcerpt(text, 500)

  try {
    const result = await generateObject({
      model: anthropic('claude-haiku-4-5-20251001'),
      schema: DomainDetectionSchema,
      system: `You are a legal document classifier. Given an excerpt from a legal document (in any language — Greek, English, French, etc.), identify its primary legal domain.

Choose from these domains:
${LEGAL_DOMAINS.map((d) => `- ${d}`).join('\n')}

If the document clearly spans two domains (e.g. a corporate merger with tax implications), provide both. Otherwise set secondaryDomain to null.

Base your classification on:
- Document title/heading if visible
- Legal terminology used
- References to specific laws, codes, or regulations
- Subject matter (parties, obligations, dispute type)`,
      messages: [
        {
          role: 'user',
          content: `Classify this legal document excerpt:\n\n${excerpt}`,
        },
      ],
      temperature: 0,
    })

    return result.object
  } catch (err) {
    console.error('[Domain Detection] Failed, defaulting to civil law:', err)
    return {
      primaryDomain: 'civil law',
      secondaryDomain: null,
      confidence: 'low',
    }
  }
}

function extractExcerpt(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text

  const truncated = words.slice(0, maxWords).join(' ')
  const sentenceEnd = truncated.lastIndexOf('.')
  if (sentenceEnd > truncated.length * 0.7) {
    return truncated.slice(0, sentenceEnd + 1)
  }
  return truncated
}
