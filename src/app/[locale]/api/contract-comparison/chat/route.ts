import {
  streamText,
  tool,
  convertToCoreMessages,
  StreamData,
  Message,
  CoreMessage,
} from 'ai'
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
import { createPostgressVectorStore } from '@/app/[locale]/actions/tool_2_actions'
import { extractContentFromUrl } from '@/app/[locale]/actions/library_actions'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'
import { revalidatePath } from 'next/cache'
import { getDefaultProviderOptions } from '@/lib/pipelineConfig'
import { chatRateLimit, checkRateLimitOrRespond } from '@/lib/rateLimitResponse'

// ====================
// CONFIGURATION
// ====================
export const maxDuration = 180

// Token and character limits
const MAX_OUTPUT_TOKEN_SIZE = 8192
const MAX_LAW_CHARACTERS_V1 = 15_000
const MAX_LAW_CHARACTERS_V2 = 10_000
const MAX_PASTCASE_CHARACTERS = 15_000
const MAX_RESULTS_PER_SOURCE = 3

// ====================
// TYPE DEFINITIONS
// ====================
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

interface ContractFile {
  storageUrl: string
  fileType: string
  fileSize?: number
}

interface RequestBody {
  messages: Message[]
  caseId: string
  includeLawbotAnswers?: boolean
  locale: string
  preferences?: {
    includeGreekLaws?: boolean
    includeGreekCourtDecisions?: boolean
    includeEuropeanLaws?: boolean
    includeEuropeanCourtDecisions?: boolean
  }
  userEmail?: string
  contracts?: ContractFile[]
  isCached?: boolean
  subscriptionId?: string
}

// ====================
// HELPER FUNCTIONS
// ====================

/**
 * Retrieves and filters data from Elasticsearch based on character limits
 */
async function retrieveAndFilterData(
  query: string,
  index: string,
  maxCharacters: number,
  model_name?: string
): Promise<string[]> {
  try {
    console.log(`Retrieving data from index: ${index}`)
    
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
    const filtered_data: string[] = []

    for (const doc of decoded_data) {
      if (total_characters + doc.length <= maxCharacters) {
        filtered_data.push(doc)
        total_characters += doc.length
      } else {
        console.log(`Max characters (${maxCharacters}) reached at ${filtered_data.length} documents`)
        break
      }
    }

    return filtered_data
  } catch (error) {
    console.error('Error in retrieveAndFilterData:', error)
    return []
  }
}

/**
 * Processes contracts and creates cached messages for the model
 */
async function processContracts(
  contracts: ContractFile[]
): Promise<any[]> {
  const cachedContracts: any[] = []
  
  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i]
    console.log(`Processing contract ${i + 1}/${contracts.length}`)
    
    const cleanedContract = await extractContentFromUrl(
      contract.storageUrl,
      contract.fileType
    )
    
    // Match the structure from your original working code
    const cachedMsg = {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: `CONTRACT ${i + 1} - ${cleanedContract}`,
          providerOptions: {
            anthropic: { 
              cacheControl: { type: 'ephemeral' } 
            },
          },
        },
      ],
    }
    
    cachedContracts.push(cachedMsg)
  }
  
  return cachedContracts
}

/**
 * Applies Voyage AI reranking to search results
 */
async function applyVoyageReranking(
  documents: string[],
  query: string,
  topK: number
): Promise<string[]> {
  try {
    const voyageClient = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY!,
    })
    
    const voyage_results: VoyageAI.RerankResponse = await voyageClient.rerank({
      model: 'rerank-2.5-lite',
      query: query,
      documents: documents,
      topK: topK,
    })
    
    console.log(`Voyage reranking completed: ${voyage_results.data?.length} results`)
    
    const ranked_results = voyage_results.data
      ?.map((result) => {
        return typeof result.index === 'number' ? documents[result.index] : undefined
      })
      .filter((item): item is string => item !== undefined)
    
    return ranked_results || documents
  } catch (error) {
    console.error('Error in Voyage reranking:', error)
    return documents // Return original documents if reranking fails
  }
}

// ====================
// MAIN API HANDLER
// ====================

export async function POST(req: Request) {
  // Parse request body
  const requestBody: RequestBody = await req.json()
  const {
    messages,
    caseId,
    includeLawbotAnswers = false,
    locale = 'en',
    preferences = {},
    userEmail,
    contracts = [],
    isCached = false,
    subscriptionId,
  } = requestBody

  // Rate limit: 10 requests/minute per user
  const rateLimitKey = subscriptionId || userEmail || 'anonymous'
  const blocked = checkRateLimitOrRespond(chatRateLimit, rateLimitKey)
  if (blocked) return blocked

  // Initialize streaming data
  const data = new StreamData()

  // Configuration flags (moved inside function to avoid scope issues)
  const USE_VOYAGE = true
  const RERANKED_K = 5

  // Extract user query from the last message
  const userQuery = messages[messages.length - 1].content
  console.log('User query:', userQuery)

  // Extract preferences with defaults
  const {
    includeGreekLaws = true,
    includeGreekCourtDecisions = false,
    includeEuropeanLaws = false,
    includeEuropeanCourtDecisions = false,
  } = preferences

  try {
    console.log('=== Starting Contract Comparison Chat ===')
    console.log({
      caseId,
      locale,
      contractCount: contracts.length,
      includeGreekLaws,
      includeGreekCourtDecisions,
      includeLawbotAnswers,
    })

    // Load the LLM model
    const selectedModel = await getLLMModel('claude-sonnet-4-6')
    console.log('Model loaded: claude-sonnet-4-6')

    // Create vector store for case files
    const vectorStore = await createPostgressVectorStore(caseId)
    console.log('Vector store created')

    // Retrieve case file names for context
    const results = await vectorStore.similaritySearch('filename_fetch', 5)
    console.log(`Found ${results.length} case files`)

    const caseFileNames = Array.from(
      new Set(
        results
          .map((result) => result.metadata?.fileName)
          .filter(Boolean)
      )
    )

    // Construct system prompt
    const caseFileNamesString = caseFileNames.length > 0
      ? `The following case files are available for reference: <case_file_name>${caseFileNames.join(', ')}</case_file_name>. `
      : ''
    
    const systemPrompt = `${caseFileNamesString}\n\n${TOOL_2_PROMPTS[locale]}`

    // Set up telemetry
    const telemetrySettings = AISDKExporter.getSettings({
      metadata: {
        userEmail: userEmail || 'anonymous',
        userQuery: userQuery,
        caseId: caseId,
        contractCount: contracts.length,
      },
      runName: 'contract_comparison_v1',
    })

    // Process contracts if not cached
    let cachedContracts: any[] = []
    if (!isCached && contracts.length > 0) {
      console.log(`Processing ${contracts.length} contracts...`)
      cachedContracts = await processContracts(contracts)
      console.log('Contracts cached successfully')
    }

    // Determine if extended context is needed
    const totalContractSize = contracts.reduce(
      (sum, c) => sum + (c.fileSize || 0), 
      0
    )
    const needsExtendedContext = contracts.length > 3 || totalContractSize > 500000

    if (needsExtendedContext) {
      console.log('Extended context mode activated for large contracts')
    }

    // Stream the response
    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      maxTokens: MAX_OUTPUT_TOKEN_SIZE,
      experimental_continueSteps: true,
      providerOptions: getDefaultProviderOptions('high'),
      experimental_telemetry: telemetrySettings,
      ...(needsExtendedContext && {
        headers: {
          'anthropic-beta': 'context-1m-2025-08-07'
        }
      }),
      tools: {
        answerQuestions: tool({
          description: 'Use this to provide detailed, case-specific insights or responses based on uploaded documents and case context.',
          parameters: z.object({
            query: z.string().describe('Query of the user'),
          }),
          execute: async ({ query }) => {
            console.log('=== Executing answerQuestions tool ===')
            console.log('Query:', query)

            try {
              // Search case files in vector store
              const vectorStore = await createPostgressVectorStore(caseId)
              const caseResults = await vectorStore.similaritySearch(userQuery, 5)
              
              console.log(`Found ${caseResults.length} relevant case file chunks`)
              
              // Map results to structured format
              const caseFileData = caseResults.map((result) => ({
                content: result.pageContent,
                filename: result.metadata?.fileName || 'Unknown file',
              }))

              // Initialize combined results
              const combinedResults: CombinedResults = {
                case_data: caseFileData,
              }

              // Collect all retrieved data for potential reranking
              let combinedRetrievedData: string[] = []

              // Retrieve Greek Laws if enabled
              if (includeGreekLaws) {
                console.log('Retrieving Greek Laws...')
                const lawResults = await retrieveAndFilterData(
                  userQuery,
                  '0825_greek_laws_collection',
                  MAX_LAW_CHARACTERS_V2,
                  'voyage-3.5-lite'
                )
                console.log(`Retrieved ${lawResults.length} law documents`)
                combinedRetrievedData = [...lawResults]
              }

              // Retrieve Greek Court Decisions if enabled
              if (includeGreekCourtDecisions) {
                console.log('Retrieving Greek Court Decisions...')
                let courtResults: string[] = []
                try {
                  const weaviateResults = await weaviateCourtSearch(userQuery)
                  if (weaviateResults.length > 0) {
                    courtResults = weaviateResults.map(r => r.fullReference).slice(0, Math.ceil(MAX_PASTCASE_CHARACTERS / 3000))
                    console.log(`Court Decisions from Weaviate: ${courtResults.length}`)
                  }
                } catch (e) {
                  console.warn('⚠️ Weaviate court search failed, using Elasticsearch fallback')
                }
                if (courtResults.length === 0) {
                  courtResults = await retrieveAndFilterData(
                    userQuery,
                    '0825_pastcase_collection',
                    MAX_PASTCASE_CHARACTERS
                  )
                }
                console.log(`Retrieved ${courtResults.length} court decisions`)
                combinedRetrievedData = [...combinedRetrievedData, ...courtResults]
              }

              // Apply Voyage reranking if enabled and we have results
              if (USE_VOYAGE && combinedRetrievedData.length > 0) {
                console.log(`Applying Voyage reranking to ${combinedRetrievedData.length} documents...`)
                const rankedResults = await applyVoyageReranking(
                  combinedRetrievedData,
                  userQuery,
                  RERANKED_K
                )
                
                combinedResults.law_data = rankedResults.slice(0, MAX_RESULTS_PER_SOURCE)
                console.log(`Final law_data: ${combinedResults.law_data.length} documents after reranking`)
              } else if (combinedRetrievedData.length > 0) {
                // No reranking, just limit results
                combinedResults.law_data = combinedRetrievedData.slice(0, MAX_RESULTS_PER_SOURCE)
                console.log(`Final law_data: ${combinedResults.law_data.length} documents (no reranking)`)
              }

              // Append case file data to stream
              data.append({ caseFileData: caseFileData })

              // Include Lawbot answers if requested (legacy feature)
              if (includeLawbotAnswers) {
                console.log('Including Lawbot answers...')
                // Note: This uses OpenAI embeddings which you mentioned might be legacy
                // Consider removing this section if not needed
                const { OpenAIEmbeddings } = await import('@langchain/openai')
                const model = new OpenAIEmbeddings({
                  apiKey: process.env.OPENAI_API_KEY!,
                  model: 'text-embedding-3-large',
                })
                
                const embeddings = await model.embedQuery(userQuery)
                const embeddedQuery = `[${embeddings.toString()}]`
                
                const dbResults = await db.execute(
                  sql`select * from match_documents_adaptive(${embeddedQuery}, 5)`
                )
                
                const lawbotData = dbResults.map((row) => row['document'] as string)
                console.log(`Retrieved ${lawbotData.length} Lawbot documents`)
                combinedResults.lawbot_data = lawbotData
              }

              console.log('=== Tool execution completed ===')
              return JSON.stringify(combinedResults)
            } catch (error) {
              console.error('Error in tool execution:', error)
              return JSON.stringify({ 
                error: 'Failed to retrieve information', 
                details: error instanceof Error ? error.message : 'Unknown error' 
              })
            }
          },
        }),
      },
      messages: convertToCoreMessages([...cachedContracts, ...messages] as any),
      async onFinish({ text, toolCalls, toolResults, usage, finishReason }) {
        console.log(`Stream finished with reason: ${finishReason}`)
        
        if (finishReason !== 'tool-calls' && finishReason !== 'content-filter') {
          data.close()
          
          // Record usage for subscription
          if (subscriptionId) {
            await recordMessageUsage(subscriptionId)
          }
          
          // Revalidate paths
          revalidatePath(`/${locale}`, 'layout')
          revalidatePath(`/${locale}/compare-contract/${caseId}`)
        }
      },
    })

    // Return streaming response
    return new Response(result.toDataStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('=== Error in POST handler ===')
    console.error(error)
    
    data.close()
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
