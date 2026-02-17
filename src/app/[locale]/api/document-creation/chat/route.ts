import { getCachedTemplate } from '@/lib/templateCache'
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
import { cookies } from 'next/headers'
import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { decodeEscapedString } from '@/lib/decoding'
import { VoyageAIClient, VoyageAI } from 'voyageai'
import { AISDKExporter } from 'langsmith/vercel'
import { saveDocumentCreationMessage } from '@/app/[locale]/actions/document_creation_actions'
import { searchSimilarDocuments } from '@/lib/elasticsearch_/embedding'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'
import { revalidatePath } from 'next/cache'
import {
  extractContentFromUrl,
  searchLibraryFiles,
} from '@/app/[locale]/actions/library_actions'
import { DOCUMENT_CREATION_PROMPTS } from '@/lib/prompts/document_creation'
import { getTemplateByKey } from '@/lib/documentCreationTemplateUtils'
import { getDefaultProviderOptions } from '@/lib/pipelineConfig'

export const maxDuration = 180

const SINGLE_MODE_CONFIG = {
  maxTokens: 16384, // Maximum tokens for single mode
  description: 'Create complete document in one response',
}

const CHAPTER_MODE_CONFIG = {
  maxTokens: 8192, // Tokens per chapter
  description: 'Create document chapter by chapter',
}

const max_law_characters_v1 = 15_000
const max_law_characters_v2 = 10_000
const max_pastcase_characters = 15_000
const MAX_RESULTS_PER_SOURCE = 3
const useVoyage = true  // FIXED: Changed from "use" to "useVoyage"
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
      knn_k: 50,
      knn_num_candidates: 250,
      rrf_rank_window_size: 50,
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

// Helper function to generate chapter prompts
function generateChapterPrompts(locale: string, totalChapters: number = 5) {
  const chapterPrompts = []

  if (locale === 'el') {
    for (let i = 1; i <= totalChapters; i++) {
      chapterPrompts.push(
        `Δημιουργήστε το Κεφάλαιο ${i} από ${totalChapters} του εγγράφου. Επικεντρωθείτε στο περιεχόμενο που είναι κατάλληλο για αυτό το κεφάλαιο βασισμένο στο αίτημά σας.`
      )
    }
  } else {
    for (let i = 1; i <= totalChapters; i++) {
      chapterPrompts.push(
        `Create Chapter ${i} of ${totalChapters} for the document. Focus on content appropriate for this chapter based on your request.`
      )
    }
  }

  return chapterPrompts
}

export async function POST(req: Request) {
  const {
    messages,
    documentCreationId,
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
    // documentMode = 'single',
  } = await req.json()
  const data = new StreamData()

  // Get the user's actual query from the last message
  const userQuery = messages[messages.length - 1].content
  console.log('User query extracted:', userQuery)

  // Add smart complexity analysis
  const analyzeComplexity = () => {
    const simpleTemplates = [
      'petition_payment_order',
      'simple_appeal',
      'withdrawal_lawsuit',
    ]
    const complexTemplates = [
      'lawsuit_general',
      'company_merger_minutes',
      'administrative_appeal_complex',
    ]

    if (selectedTemplate && simpleTemplates.includes(selectedTemplate))
      return 'single'
    if (selectedTemplate && complexTemplates.includes(selectedTemplate))
      return 'chapter'
    if (vaultFiles && vaultFiles.length > 2) return 'chapter'

    const query = userQuery.toLowerCase()
    if (
      query.includes('απλή') ||
      query.includes('simple') ||
      query.includes('σύντομη')
    )
      return 'single'
    if (
      query.includes('αναλυτική') ||
      query.includes('detailed') ||
      query.includes('εκτενής')
    )
      return 'chapter'

    return 'single' // default to single for simplicity
  }

  // Override documentMode with smart detection only for first message
  // const finalDocumentMode = messages.length <= 1 ? analyzeComplexity() : documentMode
  const finalDocumentMode = analyzeComplexity() // Always use smart detection
  console.log('Document mode:', finalDocumentMode)

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

    // Template prompt if selected
    let templatePrompt = ''
    if (selectedTemplate) {
      console.log('Setting prompt template system message...')
      const prompt = getCachedTemplate(selectedTemplate)
      templatePrompt = locale === 'el' ? prompt.prompt_greek : prompt.prompt
    }

    // Mode-specific system prompt modifications
    let modeSpecificPrompt = ''
    if (finalDocumentMode === 'chapter') {
      modeSpecificPrompt =
        locale === 'el'
          ? '\n\nΛειτουργία Κεφαλαίων: Δημιουργήστε το έγγραφο κεφάλαιο προς κεφάλαιο. Κάθε απάντηση θα πρέπει να επικεντρώνεται σε ένα συγκεκριμένο κεφάλαιο ή τμήμα του εγγράφου. Ο χρήστης θα σας καθοδηγήσει για το ποιο κεφάλαιο να δημιουργήσετε στη συνέχεια.'
          : '\n\nChapter Mode: Create the document chapter by chapter. Each response should focus on a specific chapter or section of the document. The user will guide you on which chapter to create next.'
    } else {
      modeSpecificPrompt =
        locale === 'el'
          ? '\n\nΛειτουργία Πλήρους Εγγράφου: Δημιουργήστε ένα πλήρες και ολοκληρωμένο έγγραφο σε μία απάντηση, χρησιμοποιώντας το μέγιστο διαθέσιμο αριθμό tokens.'
          : '\n\nFull Document Mode: Create a complete and comprehensive document in one response, using the maximum available tokens.'
    }

    const systemPrompt = `\n\n${DOCUMENT_CREATION_PROMPTS[locale]}\n${templatePrompt}\n${modeSpecificPrompt}`
    console.log('System prompt constructed with mode:', finalDocumentMode)

    const telemetrySettings = AISDKExporter.getSettings({
      metadata: { 
        userEmail: userEmail || 'anonymous',
        userQuery: userQuery,
        documentMode: finalDocumentMode 
      },
      runName: 'document_creation_api_v2',
    })

    // Vault Files
    let cachedVaultFiles = []

    if (!isCached && vaultFiles) {
      for (const contract of vaultFiles) {
        const cleanedFiles = await extractContentFromUrl(
          contract.storageUrl,
          contract.fileType
        )
        const cachedMsg = {
          role: 'user' as const,  // FIXED: Added type assertion
          content: [
            {
              type: 'text' as const,  // FIXED: Added type assertion
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

    // Determine maxTokens based on mode
    const maxTokens =
      finalDocumentMode === 'single'
        ? SINGLE_MODE_CONFIG.maxTokens
        : CHAPTER_MODE_CONFIG.maxTokens

    console.log(`Using ${maxTokens} max tokens for ${finalDocumentMode} mode`)
    
    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      maxTokens: maxTokens,
      providerOptions: getDefaultProviderOptions('medium'),
      experimental_telemetry: telemetrySettings,
      // No headers needed - 200K is sufficient for document creation
      tools: {
        answerQuestions: tool({
          description:
            finalDocumentMode === 'single'
              ? 'Use this to provide a complete, comprehensive document based on uploaded documents and context. Create the entire document in one response.'
              : 'Use this to provide detailed, chapter-specific content based on uploaded documents and context. Focus on creating one chapter at a time.',
          parameters: z.object({
            query: z.string().describe('Query of the user'),
            chapterFocus: z
              .string()
              .optional()
              .describe('Specific chapter or section focus (for chapter mode)'),
          }),
          execute: async ({ query, chapterFocus }) => {
            console.log('Tool execution started with query:', query)
            if (finalDocumentMode === 'chapter' && chapterFocus) {
              console.log('Chapter focus:', chapterFocus)
            }

            try {
              // Initialize combinedResults with case_data
              const combinedResults: CombinedResults = {
                case_data: [],
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
                const courtResults = await retrieveAndFilterData(
                  userQuery,
                  '0825_pastcase_collection',
                  max_pastcase_characters
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
                    console.log('rerankedResults', ranked_results.length)
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
                // Conditionally import OpenAIEmbeddings only when needed
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
                const lawbotData = dbResults.map(
                  (row) => row['document'] as string
                )
                console.log('Lawbot data retrieval complete')
                combinedResults.lawbot_data = lawbotData
              }

              // Add mode-specific metadata to the response
              const responseData = {
                ...combinedResults,
                documentMode: finalDocumentMode,
                maxTokens: maxTokens,
                chapterFocus: chapterFocus || null,
              }

              return JSON.stringify(responseData)
            } catch (e: any) {
              console.log('Error in tool execution', e.message)
              return JSON.stringify({ error: e.message })
            }
          },
        }),
      },
      messages: convertToCoreMessages(
        vaultFiles ? [...cachedVaultFiles as any, ...messages] : messages  // FIXED: Added type assertion
      ),
      async onFinish({ text, toolCalls, toolResults, usage, finishReason }) {
        console.log(
          `Streaming finished with reason: ${finishReason} in ${finalDocumentMode} mode`
        )

        if (finishReason === 'stop') {
          if (subscriptionId) {
            await recordMessageUsage(subscriptionId)
          }
          revalidatePath(`/${locale}`, 'layout')
          revalidatePath(`/${locale}/document-creation/${documentCreationId}`)
        }

        try {
          // Store the assistant's response message in the database
          if (text && text.trim() !== '') {
            await saveDocumentCreationMessage(
              documentCreationId,
              'assistant',
              text
            )
          }
        } catch (saveError) {
          console.error('Error saving assistant message:', saveError)
        }

        // Add mode-specific data to the stream
        data.append({
          documentMode: finalDocumentMode,
          maxTokens,
          tokenUsage: usage?.totalTokens || 0,
          finishReason,
        })

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
