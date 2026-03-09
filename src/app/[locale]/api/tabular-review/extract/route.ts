import { generateText } from 'ai'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { auth } from '@clerk/nextjs/server'
import db from '@/db/drizzle'
import { tabular_review_cells } from '@/db/schema_tabular_review'
import { eq } from 'drizzle-orm'

export const maxDuration = 300

/**
 * POST /api/tabular-review/extract
 *
 * Runs AI extraction for a single cell (document × column).
 * Body: { cellId, documentText, columnPrompt, columnFormat, language }
 */
export async function POST(req: Request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { cellId, documentText, columnPrompt, columnFormat, language } =
      await req.json()

    if (!cellId || !documentText || !columnPrompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mark cell as running
    await db
      .update(tabular_review_cells)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(tabular_review_cells.id, cellId))

    const formatInstruction = getFormatInstruction(columnFormat)
    const langInstruction =
      language === 'el'
        ? 'Respond in Greek (Ελληνικά).'
        : 'Respond in English.'

    const systemPrompt = `You are a legal document analysis assistant for Koutalidis Law Firm. Your task is to extract specific information from legal documents.

## Instructions
- Read the document text carefully and extract the information requested by the user's prompt.
- Be precise and cite specific clauses or sections when relevant.
- If the requested information is not found in the document, state "Not found in document" (or "Δεν βρέθηκε στο έγγραφο" in Greek).
- Do not make up or infer information that is not explicitly stated in the document.
${formatInstruction}
${langInstruction}`

    const userPrompt = `## Document Text
${documentText.slice(0, 100000)}

## Extraction Prompt
${columnPrompt}`

    const result = await generateText({
      model: await getLLMModel('claude-sonnet-4-20250514'),
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 2048,
    })

    // Save result to cell
    await db
      .update(tabular_review_cells)
      .set({
        value: result.text,
        status: 'completed',
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(tabular_review_cells.id, cellId))

    return new Response(
      JSON.stringify({ value: result.text, cellId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Tabular review extraction error:', error.message)

    // Try to mark cell as errored if we have the cellId
    try {
      const body = await req.clone().json().catch(() => null)
      if (body?.cellId) {
        await db
          .update(tabular_review_cells)
          .set({
            status: 'error',
            error: error.message,
            updatedAt: new Date(),
          })
          .where(eq(tabular_review_cells.id, body.cellId))
      }
    } catch (_) {
      // Ignore error in error handler
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function getFormatInstruction(format: string): string {
  switch (format) {
    case 'boolean':
      return '- Respond with only "Yes" or "No" (or "Ναι" / "Όχι" in Greek).'
    case 'date':
      return '- Extract and return the date in DD/MM/YYYY format. If multiple dates, list them.'
    case 'number':
      return '- Extract and return only the numeric value(s). Include currency if relevant.'
    case 'list':
      return '- Return the information as a comma-separated list.'
    default:
      return '- Provide a concise but complete answer. Keep it to 1-3 paragraphs maximum.'
  }
}
