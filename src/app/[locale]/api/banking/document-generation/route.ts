import { streamText } from 'ai'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { getToolPrompt } from '@/lib/koutalidis/tool-prompts'
import { getToolMaxTokens } from '@/lib/koutalidis/tool-config'
import { auth } from '@clerk/nextjs/server'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'

export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const { messages, toolId, projectId, locale, model, subscriptionId } =
      await req.json()
    const { userId } = auth()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const basePrompt = getToolPrompt(toolId || 'cp-checklist')
    const maxTokens = getToolMaxTokens(toolId || 'cp-checklist')

    // Add locale instruction so the AI responds in the user's language
    const localeInstruction =
      locale === 'el'
        ? '\n\nIMPORTANT: The user is using the Greek interface. Respond in Greek (Ελληνικά) unless the user writes in English or the task specifically requires English output.'
        : ''

    const systemPrompt = basePrompt + localeInstruction

    const result = await streamText({
      model: await getLLMModel(model || 'claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages,
      maxTokens,
      onFinish: async () => {
        if (subscriptionId) {
          await recordMessageUsage(subscriptionId)
        }
      },
    })

    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error('Banking document generation error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
