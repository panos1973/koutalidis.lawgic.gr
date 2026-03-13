import { OpenAIEmbeddings } from '@langchain/openai'
import { streamText, tool, convertToCoreMessages, StreamData } from 'ai'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import db from '@/db/drizzle'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { TOOL_2_PROMPTS } from '@/lib/prompts/tool_2'
import { AISDKExporter } from 'langsmith/vercel'
import { createPostgressVectorStore } from '@/app/[locale]/actions/tool_2_actions'
import { getDefaultProviderOptions } from '@/lib/pipelineConfig'
import { chatRateLimit, checkRateLimitOrRespond } from '@/lib/rateLimitResponse'
import { runLegalSearchPipeline } from '@/lib/legalSearchPipeline'

export const maxDuration = 180
const maxOutputTokenSize = 8192

// Define interfaces for our data types
interface CaseFileData {
  content: string
  filename: string
}

interface CombinedResults {
  case_data: CaseFileData[]
  law_data?: string[]
  court_data?: string[]
  lawbot_data?: string[]
}


export async function POST(req: Request) {
  const {
    messages,
    caseId,
    model,
    includeLawbotAnswers,
    locale,
    preferences,
    userEmail,
    fileChunkIds,
  } = await req.json()

  // Rate limit: 10 requests/minute per user
  const rateLimitKey = userEmail || 'anonymous'
  const blocked = checkRateLimitOrRespond(chatRateLimit, rateLimitKey)
  if (blocked) return blocked

  const data = new StreamData()

  // Get the user's actual query from the last message
  const userQuery = messages[messages.length - 1].content
  console.log('Tool-2 user query:', userQuery)

  // Default preferences if not provided
  const {
    includeGreekLaws,
    includeGreekCourtDecisions,
    includeEuropeanLaws,
    includeEuropeanCourtDecisions,
  } = preferences || {
    includeGreekLaws: true,
    includeGreekCourtDecisions: false,
    includeEuropeanLaws: false,
    includeEuropeanCourtDecisions: false,
  }

  try {
    console.log('Tool-2 POST request initiated')

    const selectedModel = await getLLMModel('claude-sonnet-4-6')
    console.log('Model loaded')

    const vectorStore = await createPostgressVectorStore(caseId)
    console.log('Vector store created')

    const results = await vectorStore.similaritySearch('filename_fetch', 5)
    console.log(`Similarity search executed with ${results.length} results`)

    results.forEach((result, index) => {
      console.log(`Result ${index + 1}:`, {
        filename: result.metadata?.fileName ?? 'Undefined filename',
        content_preview: result.pageContent.slice(0, 100) + '...',
      })
    })

    const caseFileNames = Array.from(
      new Set(
        results.map((result) => result.metadata?.fileName).filter(Boolean)
      )
    )
    console.log(`Case file names extracted: ${caseFileNames.length} files`)

    const caseFileNamesString = `The following case files are available for reference: <case_file_name>${caseFileNames.join(
      ', '
    )}</case_file_name>. `
    const systemPrompt = `${caseFileNamesString}\n\n${TOOL_2_PROMPTS[locale]}`
    console.log('System prompt constructed')

    const telemetrySettings = AISDKExporter.getSettings({
      metadata: { userEmail, userQuery },
      runName: 'tool_2_api_v2',
    })

    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      maxTokens: maxOutputTokenSize,
      experimental_continueSteps: true,
      providerOptions: getDefaultProviderOptions('medium'),
      experimental_telemetry: telemetrySettings,
      tools: {
        answerQuestions: tool({
          description:
            'Use this to provide detailed, case-specific insights or responses based on uploaded documents and case context. Do not mention the answerQuestions function. ',
          parameters: z.object({
            query: z.string().describe('Query of the user'),
          }),
          execute: async ({ query }) => {
            console.log('Tool execution started with query:', query)

            try {
              // Get results from vector store using the actual user query
              const vectorStore = await createPostgressVectorStore(caseId)
              const results = await vectorStore.similaritySearch(userQuery, 5)

              console.log('Detailed Similarity Search Results:')
              results.forEach((result, index) => {
                console.log(`Match ${index + 1}:`, {
                  filename: result.metadata?.fileName ?? 'Undefined filename',
                  content_preview: result.pageContent.slice(0, 100) + '...',
                })
              })

              const resultArray = results.map((result) => ({
                content: result.pageContent,
                filename: result.metadata?.fileName || 'Unknown file',
              }))

              // Initialize combinedResults with case_data
              const combinedResults: CombinedResults = {
                case_data: resultArray,
              }

              // Run upgraded legal search pipeline (query analysis + parallel search + reranking + court guarantee)
              const searchResults = await runLegalSearchPipeline(userQuery, {
                includeGreekLaws,
                includeGreekCourtDecisions,
                conversationMessages: messages,
                locale,
              })

              if (searchResults.rerankedResults.length > 0) {
                combinedResults.law_data = searchResults.rerankedResults
                console.log(`Legal search: ${searchResults.rerankedResults.length} results (laws=${searchResults.lawResults.length}, courts=${searchResults.courtResults.length}, internet=${searchResults.internetResults.length})`)
              }

              data.append({ caseFileData: resultArray })

              if (includeLawbotAnswers) {
                const model = new OpenAIEmbeddings({
                  apiKey: process.env.OPENAI_API_KEY!,
                  model: 'text-embedding-3-large',
                })
                const embeddings = await model.embedQuery(userQuery)
                const embeddedQuery = `[${embeddings.toString()}]`
                const dbResults = await db.execute(
                  sql`select * from match_documents_adaptive(${embeddedQuery}, 5)`
                )
                const lawbotData = dbResults.map(
                  (row) => row['document'] as string
                )
                console.log('Lawbot data retrieval complete')
                combinedResults.lawbot_data = lawbotData
              }

              return JSON.stringify(combinedResults)
            } catch (e: any) {
              console.log('Error in tool execution', e.message)
              return e
            }
          },
        }),
      },
      messages: convertToCoreMessages(messages),
      async onFinish({ text, toolCalls, toolResults, usage, finishReason }) {
        console.log(`Streaming finished with reason: ${finishReason}`)
        data.close()
      },
    })

    return new Response(result.toDataStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Error in POST handler:', error.message)
    data.close()
    throw error
  }
}
