import { generateText } from 'ai'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { auth } from '@clerk/nextjs/server'

export const maxDuration = 60

/**
 * POST /api/tabular-review/generate-prompt
 *
 * Uses AI to generate an extraction prompt and suggest format
 * based on the user's column label description.
 * Body: { label, language }
 */
export async function POST(req: Request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { label, language } = await req.json()

    if (!label?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Label is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const langInstruction =
      language === 'el'
        ? 'The extraction prompt you generate should instruct the AI to respond in Greek (Ελληνικά).'
        : 'The extraction prompt you generate should instruct the AI to respond in English.'

    const systemPrompt = `You are an expert legal document analysis assistant for Koutalidis Law Firm. Your task is to help users create extraction prompts for analyzing legal documents.

The user will provide a column label or description. Based on this, you must:
1. Generate a clear, precise extraction prompt that will be used to extract relevant information from legal documents.
2. Suggest the best output format for this type of information.

${langInstruction}

## Guidelines for generating prompts:
- The prompt should be specific and actionable
- It should instruct the AI to look for specific clauses, provisions, terms, or information
- It should specify what to do if the information is not found
- For legal concepts, include relevant sub-categories or aspects to look for
- The prompt should work across different types of legal documents

## Available formats:
- "text": For free-text answers, summaries, descriptions (default)
- "boolean": For yes/no questions (e.g., "Does the contract contain X?")
- "date": For dates (DD/MM/YYYY)
- "number": For numeric values, amounts, percentages
- "list": For comma-separated lists of items

## Response Format
Respond with a valid JSON object:
{
  "prompt": "The generated extraction prompt",
  "format": "text|boolean|date|number|list"
}`

    const userPrompt = `Generate an extraction prompt for a column labeled: "${label}"`

    const result = await generateText({
      model: await getLLMModel('claude-sonnet-4-20250514'),
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1024,
    })

    // Parse response
    let prompt = `Extract information about "${label}" from the document. Provide a concise but complete summary.`
    let format = 'text'

    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        prompt = parsed.prompt || prompt
        format = parsed.format || format
      }
    } catch {
      // If parsing fails, use the raw text as the prompt
      if (result.text.trim()) {
        prompt = result.text.trim()
      }
    }

    return new Response(
      JSON.stringify({ prompt, format }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Generate prompt error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
