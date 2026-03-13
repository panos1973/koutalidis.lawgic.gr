import { OpenAIEmbeddings } from '@langchain/openai'
import { streamText, tool, convertToCoreMessages, StreamData } from 'ai'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import db from '@/db/drizzle'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { TOOL_2_PROMPTS } from '@/lib/prompts/tool_2'
import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { weaviateCourtSearch } from '@/lib/retrievers/weaviate_court_retriever'
import { weaviateLawSearch } from '@/lib/retrievers/weaviate_law_retriever'
import { decodeEscapedString } from '@/lib/decoding'
import { VoyageAIClient, VoyageAI } from 'voyageai'
import { AISDKExporter } from 'langsmith/vercel'
import { createPostgressVectorStore } from '@/app/[locale]/actions/tool_2_actions'
import { getDefaultProviderOptions } from '@/lib/pipelineConfig'
import { chatRateLimit, checkRateLimitOrRespond } from '@/lib/rateLimitResponse'
import { analyzeQuery } from '@/lib/queryAnalyzer'
import { searchInternetForLegal } from '@/lib/internetSearchUtils'
import { searchYouComForLegal } from '@/lib/youComSearchUtils'

export const maxDuration = 180
const maxOutputTokenSize = 8192
const max_law_characters = 15_000
const max_court_characters = 15_000
const useVoyage = true
const RERANKED_K = 8

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

  const needsLegalSearch = includeGreekLaws || includeGreekCourtDecisions

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

    // Run query analysis in parallel with model setup (only if legal search is needed)
    const queryAnalysisPromise = needsLegalSearch
      ? analyzeQuery(userQuery, messages.slice(-6), locale)
      : null

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

              // ========== UPGRADED SEARCH PIPELINE ==========
              // Get query analysis result (adapted queries per source)
              const queryAnalysis = queryAnalysisPromise ? await queryAnalysisPromise : null
              const enhanced = queryAnalysis?.enhanced
              const vectorDbQuery = enhanced?.adaptedQueries?.vectorDb || userQuery
              const perplexityQuery = enhanced?.adaptedQueries?.perplexity || userQuery
              const youcomQuery = enhanced?.adaptedQueries?.youcom || userQuery

              if (enhanced) {
                console.log(`Query Analysis: field=${enhanced.legalField}, domain=${enhanced.detectedDomain}`)
                console.log(`Adapted queries: vectorDb="${vectorDbQuery.substring(0, 80)}..."`)
              }

              // Track law and court results separately for court guarantee
              let lawResults: string[] = []
              let courtResults: string[] = []
              let internetResults: string[] = []

              // Run all searches in parallel
              const searchPromises: Promise<void>[] = []

              // Database law search
              if (includeGreekLaws) {
                searchPromises.push(
                  (async () => {
                    try {
                      const weaviateLawResults = await weaviateLawSearch(vectorDbQuery, {
                        limit: 20,
                        legalDomain: enhanced?.legalField ? [enhanced.legalField] : undefined,
                      })
                      if (weaviateLawResults.length > 0) {
                        // Use aiVersion (compact) for LLM context, not fullReference
                        let totalChars = 0
                        for (const r of weaviateLawResults) {
                          if (totalChars + r.aiVersion.length > max_law_characters) break
                          lawResults.push(r.aiVersion)
                          totalChars += r.aiVersion.length
                        }
                        console.log(`Greek Laws from Weaviate: ${lawResults.length} (${totalChars} chars)`)
                      }
                    } catch (e) {
                      console.warn('Weaviate law search failed, using Elasticsearch fallback')
                    }
                    if (lawResults.length === 0) {
                      lawResults = await retrieveAndFilterData(
                        vectorDbQuery,
                        '0825_greek_laws_collection',
                        max_law_characters,
                        'voyage-3.5-lite'
                      )
                      console.log(`Greek Laws from Elasticsearch: ${lawResults.length}`)
                    }
                  })()
                )
              }

              // Database court decision search
              if (includeGreekCourtDecisions) {
                searchPromises.push(
                  (async () => {
                    try {
                      const weaviateResults = await weaviateCourtSearch(vectorDbQuery)
                      if (weaviateResults.length > 0) {
                        let totalChars = 0
                        for (const r of weaviateResults) {
                          if (totalChars + r.aiVersion.length > max_court_characters) break
                          courtResults.push(r.aiVersion)
                          totalChars += r.aiVersion.length
                        }
                        console.log(`Court Decisions from Weaviate: ${courtResults.length} (${totalChars} chars)`)
                      }
                    } catch (e) {
                      console.warn('Weaviate court search failed, using Elasticsearch fallback')
                    }
                    if (courtResults.length === 0) {
                      courtResults = await retrieveAndFilterData(
                        vectorDbQuery,
                        '0825_pastcase_collection',
                        max_court_characters
                      )
                      console.log(`Court Decisions from Elasticsearch: ${courtResults.length}`)
                    }
                  })()
                )
              }

              // Internet search (Perplexity + You.com) for supplementary results
              if (needsLegalSearch) {
                // Perplexity search
                searchPromises.push(
                  (async () => {
                    try {
                      const perplexityResult = await searchInternetForLegal(perplexityQuery, {
                        legalCategories: enhanced?.legalField ? [enhanced.legalField] : undefined,
                        keywords: enhanced?.keyPhrases || [],
                      })
                      if (perplexityResult?.success) {
                        const allItems = [
                          ...(perplexityResult.legislation || []),
                          ...(perplexityResult.jurisprudence || []),
                          ...(perplexityResult.developments || []),
                        ]
                        for (const item of allItems) {
                          if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
                            internetResults.push(
                              `**[Perplexity] ${item.title}**\n\n${item.preview_text}\n\n[Source: ${item.source_domain}](${item.url})`
                            )
                          }
                        }
                        console.log(`Perplexity results: ${internetResults.length}`)
                      }
                    } catch (e) {
                      console.warn('Perplexity search failed:', e)
                    }
                  })()
                )

                // You.com search
                searchPromises.push(
                  (async () => {
                    try {
                      const youComResult = await searchYouComForLegal(youcomQuery)
                      if (youComResult?.success) {
                        const allItems = [
                          ...(youComResult.legislation || []),
                          ...(youComResult.jurisprudence || []),
                          ...(youComResult.developments || []),
                        ]
                        const youcomItems: string[] = []
                        for (const item of allItems) {
                          if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
                            youcomItems.push(
                              `**[You.com] ${item.title}**\n\n${item.preview_text}\n\n[Source: ${item.source_domain}](${item.url})`
                            )
                          }
                        }
                        internetResults.push(...youcomItems)
                        console.log(`You.com results: ${youcomItems.length}`)
                      }
                    } catch (e) {
                      console.warn('You.com search failed:', e)
                    }
                  })()
                )
              }

              await Promise.allSettled(searchPromises)

              // Combine all results: laws first, then courts, then internet
              const combined_retrieved_data = [
                ...lawResults,
                ...courtResults,
                ...internetResults,
              ]

              console.log(`Total pre-reranking: laws=${lawResults.length}, courts=${courtResults.length}, internet=${internetResults.length}, total=${combined_retrieved_data.length}`)

              // Apply Voyage reranking with court decision guarantee
              if (useVoyage && combined_retrieved_data.length > 0) {
                try {
                  const voyageClient = new VoyageAIClient({
                    apiKey: process.env.VOYAGE_API_KEY!,
                  })

                  const dynamicTopK = Math.min(RERANKED_K, combined_retrieved_data.length)

                  const voyage_results: VoyageAI.RerankResponse =
                    await voyageClient.rerank({
                      model: 'rerank-2.5-lite',
                      query: userQuery,
                      documents: combined_retrieved_data,
                      topK: dynamicTopK,
                    })

                  let ranked_results = voyage_results.data
                    ?.map((result) => {
                      const index = result.index
                      return index !== undefined
                        ? combined_retrieved_data[index]
                        : undefined
                    })
                    .filter((item): item is string => item !== undefined)

                  if (ranked_results && ranked_results.length > 0) {
                    // Court decision guarantee: ensure court results are not dropped
                    if (includeGreekCourtDecisions && courtResults.length > 0) {
                      const missingCourts = courtResults.filter(
                        (cr) => !ranked_results!.includes(cr)
                      )
                      if (missingCourts.length > 0) {
                        console.log(`Guaranteeing ${missingCourts.length} court decisions in reranked results`)
                        ranked_results = [...ranked_results, ...missingCourts.slice(0, 2)]
                      }
                    }

                    console.log(`Reranked results: ${ranked_results.length}`)
                    combinedResults.law_data = ranked_results
                  }
                } catch (e) {
                  console.error('Error in Voyage reranking:', e)
                  combinedResults.law_data = combined_retrieved_data
                }
              } else {
                combinedResults.law_data = combined_retrieved_data
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
