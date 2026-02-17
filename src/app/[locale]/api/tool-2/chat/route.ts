import { OpenAIEmbeddings } from '@langchain/openai'
import { streamText, tool, convertToCoreMessages, StreamData } from 'ai'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import db from '@/db/drizzle'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { TOOL_2_PROMPTS } from '@/lib/prompts/tool_2'
import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { weaviateCourtSearch } from '@/lib/retrievers/weaviate_court_retriever'
import { decodeEscapedString } from '@/lib/decoding'
import { VoyageAIClient, VoyageAI } from 'voyageai'
import { AISDKExporter } from 'langsmith/vercel'
// import { searchVaultFiles } from '@/app/[locale]/actions/vault_actions'
import { createPostgressVectorStore } from '@/app/[locale]/actions/tool_2_actions'
import { getDefaultProviderOptions } from '@/lib/pipelineConfig'

export const maxDuration = 180
// const maxOutputTokenSize = 4000
const maxOutputTokenSize = 8192
const max_law_characters_v1 = 15_000
const max_law_characters_v2 = 10_000
const max_pastcase_characters = 15_000
const MAX_RESULTS_PER_SOURCE = 3
const useVoyage = true
const reranked_k = 5

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

async function retrieveAndFilterData(
  query: string,
  index: string,
  maxCharacters: number,
  model_name?: string
) {
  try {
    const retrieved_data = await elasticsearchRetrieverHybridSearch(query, {
      knn_k: 20,
      knn_num_candidates: 60,
      rrf_rank_window_size: 15,
      rrf_rank_constant: 20,
      index: index,
      model_name: model_name,
    })

    const decoded_data = retrieved_data.map(
      (doc: { aiVersion: string; fullReference: string }) =>
        decodeEscapedString(doc.fullReference)
    )

    let total_characters = 0
    const filtered_data = []

    for (const doc of decoded_data) {
      if (total_characters + doc.length <= maxCharacters) {
        filtered_data.push(doc)
        total_characters += doc.length
      } else {
        console.log('max_characters reached in ', filtered_data.length)
        break
      }
    }

    return filtered_data
  } catch (error) {
    console.error('Error in retrieveAndFilterData:', error)
    return []
  }
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
  const data = new StreamData()

  // Get the user's actual query from the last message
  const userQuery = messages[messages.length - 1].content
  console.log('User query extracted:', userQuery)

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
    console.log('POST request initiated')

    // let selectedModel = await getLLMModel("claude-sonnet-4-6");
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
      runName: 'tool_2_api_v1',
    })
       const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      maxTokens: maxOutputTokenSize,
      experimental_continueSteps: true,
      providerOptions: getDefaultProviderOptions('medium'),
      experimental_telemetry: telemetrySettings,
      // No headers needed - 200K is default
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
              // Get results from vector store
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

              let combined_retrieved_data: string[] = []

              // Add Elasticsearch results based on preferences
              if (includeGreekLaws) {
                const lawResults = await retrieveAndFilterData(
                  userQuery,
                  '0825_greek_laws_collection',
                  max_law_characters_v2,
                  'voyage-3.5-lite'
                )
                console.log('Greek Laws retrieved:', lawResults.length)
                combined_retrieved_data = [...lawResults]
              }

              if (includeGreekCourtDecisions) {
                let courtResults: string[] = []
                try {
                  const weaviateResults = await weaviateCourtSearch(userQuery)
                  if (weaviateResults.length > 0) {
                    courtResults = weaviateResults.map(r => r.fullReference).slice(0, Math.ceil(max_pastcase_characters / 3000))
                    console.log(`Court Decisions from Weaviate: ${courtResults.length}`)
                  }
                } catch (e) {
                  console.warn('⚠️ Weaviate court search failed, using Elasticsearch fallback')
                }
                if (courtResults.length === 0) {
                  courtResults = await retrieveAndFilterData(
                    userQuery,
                    '0825_pastcase_collection',
                    max_pastcase_characters
                  )
                }
                console.log('Court Decisions retrieved:', courtResults.length)
                combined_retrieved_data = [
                  ...combined_retrieved_data,
                  ...courtResults,
                ]
              }

              //   if (fileChunkIds && fileChunkIds.length > 0) {
              //     console.log(
              //       `Searching ${fileChunkIds.length} user vault documents`
              //     )
              //     const result = await searchVaultFiles(userQuery, fileChunkIds)
              //     const finalResult = `These are the use vault documents search results,
              // use them to enhance the responses. Search Results: ${result}`
              //     combined_retrieved_data.push(finalResult)
              //   }

              // Apply Voyage reranking if enabled
              if (useVoyage && combined_retrieved_data.length > 0) {
                try {
                  const voyageClient = new VoyageAIClient({
                    apiKey: process.env.VOYAGE_API_KEY!,
                  })
                  const voyage_results: VoyageAI.RerankResponse =
                    await voyageClient.rerank({
                      model: 'rerank-2.5-lite',
                      query: userQuery,
                      documents: combined_retrieved_data,
                      topK: reranked_k,
                    })
                  console.log('voyage_results', voyage_results)
                  const ranked_results = voyage_results.data
                    ?.map((result) => {
                      const index = result.index
                      return index !== undefined
                        ? combined_retrieved_data[index]
                        : undefined
                    })
                    .filter((item): item is string => item !== undefined)

                  if (ranked_results && ranked_results.length > 0) {
                    console.log('case_rerankedResults', ranked_results.length)
                    combinedResults.law_data = ranked_results.slice(
                      0,
                      MAX_RESULTS_PER_SOURCE
                    )
                  }
                } catch (e) {
                  console.error('Error in Voyage reranking:', e)
                  combinedResults.law_data = combined_retrieved_data.slice(
                    0,
                    MAX_RESULTS_PER_SOURCE
                  )
                }
              } else {
                combinedResults.law_data = combined_retrieved_data.slice(
                  0,
                  MAX_RESULTS_PER_SOURCE
                )
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
