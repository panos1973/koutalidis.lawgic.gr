import { getCachedTemplate } from '@/lib/templateCache'
import { OpenAIEmbeddings } from '@langchain/openai'
import {
  streamText,
  tool,
  convertToCoreMessages,
  StreamData,
  Message,
} from 'ai'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import db from '@/db/drizzle'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { CASE_STUDY_PROMPTS } from '@/lib/prompts/case_study'
import { saveCaseMessage } from '@/app/[locale]/actions/case_study_actions'
import { cookies } from 'next/headers'
import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { decodeEscapedString } from '@/lib/decoding'
import { VoyageAIClient, VoyageAI } from 'voyageai'
import { AISDKExporter } from 'langsmith/vercel'

import { searchSimilarDocuments } from '@/lib/elasticsearch_/embedding'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'
import { revalidatePath } from 'next/cache'
import { getDefaultProviderOptions } from '@/lib/pipelineConfig'
import {
  extractContentFromUrl,
  searchLibraryFiles,
} from '@/app/[locale]/actions/library_actions'
import { getTemplateByKey, type CaseResearchTemplateKey } from '@/lib/caseResearchTemplateUtils'

export const maxDuration = 180
const maxOutputTokenSize = 8192

// Base character limits - will be adjusted dynamically
const BASE_LAW_CHARACTERS_V1 = 15_000
const BASE_LAW_CHARACTERS_V2 = 10_000
const BASE_PASTCASE_CHARACTERS = 15_000

// Dynamic limits based on document count
const getCharacterLimits = (userDocumentCount: number) => {
  // Scale down limits as document count increases
  let scaleFactor = 1;
  if (userDocumentCount > 40) scaleFactor = 0.3;
  else if (userDocumentCount > 30) scaleFactor = 0.5;
  else if (userDocumentCount > 20) scaleFactor = 0.7;
  else if (userDocumentCount > 10) scaleFactor = 0.85;
  
  return {
    max_law_characters_v1: Math.floor(BASE_LAW_CHARACTERS_V1 * scaleFactor),
    max_law_characters_v2: Math.floor(BASE_LAW_CHARACTERS_V2 * scaleFactor),
    max_pastcase_characters: Math.floor(BASE_PASTCASE_CHARACTERS * scaleFactor)
  };
};

const MAX_RESULTS_PER_SOURCE = 10  // Increased to benefit from reranking
const useVoyage = true
let reranked_k = 5  // Dynamic reranking based on document count - will be set later

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

// Define interface for vault file structure
interface VaultFile {
  storageUrl: string
  fileType: string
  fileSize?: number
}

async function retrieveAndFilterData(
  query: string,
  index: string,
  maxCharacters: number,
  model_name?: string,
  documentCount: number = 0  // NEW PARAMETER
) {
  try {
    // Scale search parameters based on document count
    const searchParams = {
      knn_k: Math.min(40, 20 + Math.floor(documentCount / 2)),
      knn_num_candidates: Math.min(120, 60 + documentCount),
      rrf_rank_window_size: Math.min(30, 15 + Math.floor(documentCount / 3)),
      rrf_rank_constant: 20,
      index: index,
      model_name: model_name,
    };
    
    console.log(`🔍 Scaled search params for ${documentCount} docs:`, searchParams);
    
    const retrieved_data = await elasticsearchRetrieverHybridSearch(query, searchParams)

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

// Ensure we sample across all documents, not just the top-scoring ones
function prioritizeDocumentCoverage(results: any[], maxResults: number = 15) {
  if (results.length <= maxResults) return results;
  
  // Group results by source document
  const resultsByDoc: { [key: string]: any[] } = {};
  results.forEach(result => {
    const docName = result.metadata?.fileName || 'unknown';
    if (!resultsByDoc[docName]) resultsByDoc[docName] = [];
    resultsByDoc[docName].push(result);
  });
  
  const prioritized: any[] = [];
  const docNames = Object.keys(resultsByDoc);
  
  console.log(`📚 Found chunks from ${docNames.length} different documents`);
  
  // First pass: Take the best chunk from each document
  for (const docName of docNames) {
    if (prioritized.length >= maxResults) break;
    prioritized.push(resultsByDoc[docName][0]);
  }
  
  // Second pass: Fill remaining slots with best overall chunks
  const remaining = maxResults - prioritized.length;
  if (remaining > 0) {
    const allChunks = results.filter(r => !prioritized.includes(r));
    prioritized.push(...allChunks.slice(0, remaining));
  }
  
  console.log(`✅ Prioritized ${prioritized.length} chunks covering ${Math.min(docNames.length, maxResults)} documents`);
  return prioritized;
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
    vaultFiles,
    isCached,
    userId,
    subscriptionId,
    selectedTemplate,
  }: {
    messages: Message[]
    caseId: string
    model?: string
    includeLawbotAnswers?: boolean
    locale: string
    preferences?: {
      includeGreekLaws?: boolean
      includeGreekCourtDecisions?: boolean
      includeEuropeanLaws?: boolean
      includeEuropeanCourtDecisions?: boolean
    }
    userEmail?: string
    fileChunkIds?: string[]
    vaultFiles?: VaultFile[]
    isCached?: boolean
    userId?: string
    subscriptionId?: string
    selectedTemplate?: CaseResearchTemplateKey
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

    const selectedModel = await getLLMModel('claude-sonnet-4-6')
    console.log('Model loaded')

    // Get results from Elasticsearch
    const userIdentifier = userId || 'anonymous'
    
    // Get case file count for optimization calculations
    let caseFileCount = 0;
    if (vaultFiles && Array.isArray(vaultFiles)) {
      caseFileCount = vaultFiles.length;
    }
    console.log(`📁 Case has ${caseFileCount} files uploaded`);

    // If a prompt template is chosen
    let templatePrompt = ''
    if (selectedTemplate) {
      console.log('Setting prompt template system message...')
      const prompt = getCachedTemplate(selectedTemplate as CaseResearchTemplateKey)  // Type assertion needed here
      templatePrompt = locale === 'el' ? prompt.prompt_greek : prompt.prompt
    }

    const systemPrompt = `\n\n${CASE_STUDY_PROMPTS[locale]}\n${templatePrompt}`
    console.log('System prompt constructed')

    const telemetrySettings = AISDKExporter.getSettings({
      metadata: { 
        userEmail: userEmail || 'anonymous',
        userQuery: userQuery 
      },
      runName: 'case_api_v1',
    })

    // Vault Files
    let cachedVaultFiles: any[] = []

    if (!isCached && vaultFiles) {
      for (const contract of vaultFiles) {
        const cleanedFiles = await extractContentFromUrl(
          contract.storageUrl,
          contract.fileType
        )
        const cachedMsg = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `One of the Case File or The case file 
              Uploaded by the user. Take this as the primary
              sources of user provided case content - ${cleanedFiles}`,
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral' } },
              },
            },
          ],
        }
        cachedVaultFiles.push(cachedMsg)
      }
    }
    
    // Check if extended context is needed for large cases
    const needsExtendedContext = caseFileCount > 10 || 
      (vaultFiles && vaultFiles.reduce((sum: number, file: VaultFile) => sum + (file.fileSize || 0), 0) > 500000);
    
    // Determine maxTokens based on mode (if mode parameter exists in the future)
    const maxTokens = maxOutputTokenSize
    
    console.log(`Using ${maxTokens} max tokens for response`)

    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      maxTokens: maxTokens,
      experimental_continueSteps: true,
      experimental_telemetry: telemetrySettings,
      providerOptions: getDefaultProviderOptions('high'),
      // Use 1M context only when needed for large cases
      ...(needsExtendedContext && {
        headers: {
          'anthropic-beta': 'context-1m-2025-08-07'
        }
      }),
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
              // Initialize combinedResults with case_data
              const combinedResults: CombinedResults = {
                case_data: [],
              }

              // Get dynamic character limits based on document count
              const userDocumentCount = caseFileCount || 0;
              const { max_law_characters_v1, max_law_characters_v2, max_pastcase_characters } = 
                getCharacterLimits(userDocumentCount);
              console.log(`📊 Dynamic limits for ${userDocumentCount} docs: Laws=${max_law_characters_v2}, Cases=${max_pastcase_characters}`);

              let combined_retrieved_data: string[] = []

              // Add Elasticsearch results based on preferences
              if (includeGreekLaws) {
                const lawResults = await retrieveAndFilterData(
                  userQuery,
                  '0825_greek_laws_collection',  // Fixed index name
                  max_law_characters_v2,
                  'voyage-3.5-lite',
                  userDocumentCount
                )
                console.log('Greek Laws retrieved:', lawResults.length)
                combined_retrieved_data = [...lawResults]
              }

              if (includeGreekCourtDecisions) {
                const courtResults = await retrieveAndFilterData(
                  userQuery,
                  '0825_pastcase_collection',  // Fixed index name
                  max_pastcase_characters,
                  'voyage-3.5-lite',
                  userDocumentCount
                )
                console.log('Court Decisions retrieved:', courtResults.length)
                combined_retrieved_data = [
                  ...combined_retrieved_data,
                  ...courtResults,
                ]
              }

              if (fileChunkIds && fileChunkIds.length > 0) {
                console.log(
                  `Searching ${fileChunkIds.length} user library documents`
                )
                const result = await searchLibraryFiles(userQuery, fileChunkIds)
                const finalResult = `These are the user library
                documents search results, 
                use them to enhance the responses. Search Results: ${result}`
                combined_retrieved_data.push(finalResult)
              }

              // Apply Voyage reranking if enabled
              if (useVoyage && combined_retrieved_data.length > 0) {
                try {
                  const voyageClient = new VoyageAIClient({
                    apiKey: process.env.VOYAGE_API_KEY!,
                  })
                  
                  // Calculate reranked_k based on number of user documents
                  reranked_k = Math.min(15, Math.max(5, Math.ceil(caseFileCount / 3)));
                  console.log(`🎯 Dynamic reranking: ${reranked_k} results for ${caseFileCount} documents`);
                  
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

              // Add monitoring metrics (temporary - remove after testing)
              console.log('=== OPTIMIZATION METRICS ===');
              console.log(`Documents uploaded: ${userDocumentCount}`);
              console.log(`Character limits: Laws=${max_law_characters_v2}, Cases=${max_pastcase_characters}`);
              console.log(`Reranking K: ${reranked_k}`);
              console.log(`Total data retrieved: ${JSON.stringify(combinedResults).length} chars`);
              console.log(`Total tokens estimate: ${JSON.stringify(combinedResults).length / 4}`);
              console.log('===========================');

              return JSON.stringify(combinedResults)
            } catch (e: any) {
              console.log('Error in tool execution', e.message)
              return JSON.stringify({ error: e.message })
            }
          },
        }),
      },
      messages: convertToCoreMessages(
        vaultFiles ? [...cachedVaultFiles, ...messages] : messages
      ),
      async onFinish({ text, toolCalls, toolResults, usage, finishReason }) {
        console.log(`Streaming finished with reason: ${finishReason}`)

        if (finishReason === 'stop') {
          if (subscriptionId) {
            await recordMessageUsage(subscriptionId)
          }
          revalidatePath(`/${locale}`, 'layout')
          revalidatePath(`/${locale}/case-research/${caseId}`)
        }

        try {
          // Store the assistant's response message in the database
          if (text && text.trim() !== '') {
            await saveCaseMessage(caseId, 'assistant', text)
          }
        } catch (saveError) {
          console.error('Error saving assistant message:', saveError)
        }

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
