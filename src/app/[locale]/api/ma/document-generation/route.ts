import { streamText } from 'ai'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { getToolPrompt } from '@/lib/koutalidis/tool-prompts'
import { auth } from '@clerk/nextjs/server'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'

export const maxDuration = 180

export async function POST(req: Request) {
  try {
    const { messages, toolId, projectId, locale, model, subscriptionId } =
      await req.json()
    const { userId } = auth()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const systemPrompt = getToolPrompt(toolId || 'dd-report')

    const result = await streamText({
      model: await getLLMModel(model || 'claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages,
      maxTokens: 16384,
      onFinish: async () => {
        if (subscriptionId) {
          await recordMessageUsage(subscriptionId)
        }
      },
    })

    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error('M&A document generation error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
