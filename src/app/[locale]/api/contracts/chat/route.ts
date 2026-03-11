import { traceable, getCurrentRunTree } from 'langsmith/traceable'
import { OpenAIEmbeddings } from '@langchain/openai'
import { streamText, tool, convertToCoreMessages, StreamData } from 'ai'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import db from '@/db/drizzle'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { CONTRACT_PROMPTS } from '@/lib/prompts/contract'
import { createContractVectorStore } from '@/app/[locale]/actions/contract_action'
import { cookies } from 'next/headers'
import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { decodeEscapedString } from '@/lib/decoding'
import { VoyageAIClient, VoyageAI } from 'voyageai'
import { AISDKExporter } from 'langsmith/vercel'
import { recordMessageUsage } from '@/app/[locale]/actions/subscription'
import { revalidatePath } from 'next/cache'
import { extractContentFromUrl } from '@/app/[locale]/actions/library_actions'
import { getDefaultProviderOptions } from '@/lib/pipelineConfig'
import { chatRateLimit, checkRateLimitOrRespond } from '@/lib/rateLimitResponse'

export const maxDuration = 180
const maxOutputTokenSize = 8192
const max_law_characters_v2 = 10_000
const max_pastcase_characters = 15_000
const MAX_RESULTS_PER_SOURCE = 3
const useVoyage = true
const reranked_k = 5

// Define interfaces for data types
interface ContractFileData {
  content: string
  filename: string
}

interface CombinedResults {
  contract_data: ContractFileData[]
  law_data?: string[]
  court_data?: string[]
}

// Helper function to extract contract structure
async function extractContractStructure(url: string, type: string) {
  const content = await extractContentFromUrl(url, type)
  
  // Extract only key structural elements
  const chapters = content.match(/ΚΕΦΑΛΑΙΟ|CHAPTER|ARTICLE|ΑΡΘΡΟ|ARTICLE|Article|Chapter/gi) || []
  const amounts = content.match(/€\d+|[$]\d+/g) || []
  const dates = content.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []
  const parties = content.match(/(?:Landlord|Tenant|Εκμισθωτής|Μισθωτής|ΕΚΜΙΣΘΩΤΗΣ|ΜΙΣΘΩΤΗΣ):\s*([^\n,]+)/gi) || []
  
  return JSON.stringify({
    totalChapters: chapters.length,
    keyAmounts: amounts.slice(0, 5),
    keyDates: dates.slice(0, 5),
    parties: parties.slice(0, 4),
    documentLength: content.length
  })
}

async function retrieveAndFilterData(
  query: string,
  index: string,
  maxCharacters: number,
  model_name?: string
) {
  console.log(`Starting retrieveAndFilterData for index: ${index}`)
  try {
    console.log('Calling elasticsearchRetrieverHybridSearch with params:', {
      query,
      index,
      maxCharacters,
      model_name,
    })
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
  return await traceable(
    async () => {
      const data = new StreamData()

      try {
        console.log('POST request initiated')
        const {
          messages,
          contractId,
          model,
          contract,
          fields,
          locale,
          preferences,
          subscriptionId,
          selectedVaultFiles: originalVaultFiles,
        } = await req.json()
        console.log('Request parameters:', { contractId, model, locale })

        // Rate limit: 10 requests/minute per user
        const rateLimitKey = subscriptionId || contractId || 'anonymous'
        const blocked = checkRateLimitOrRespond(chatRateLimit, rateLimitKey)
        if (blocked) return blocked

        let cachedVaultFiles = []
        
        // Check if we have multiple contracts (max 3)
        let selectedVaultFiles = originalVaultFiles
        if (selectedVaultFiles && selectedVaultFiles.length > 3) {
          console.log('Warning: More than 3 contracts uploaded, using first 3 only')
          selectedVaultFiles = selectedVaultFiles.slice(0, 3)
        }
        
        if (selectedVaultFiles) {
          console.log('Processing contracts for structure extraction')

          for (let index = 0; index < selectedVaultFiles.length; index++) {
            const contract = selectedVaultFiles[index]
            
            // Extract structure instead of full content
            const contractStructure = await extractContractStructure(
              contract.storageUrl,
              contract.fileType
            )
            
            // Label contracts based on locale
            const contractLabel = selectedVaultFiles.length > 1 
              ? locale === 'el' 
                ? `Αρχείο ${String.fromCharCode(913 + index)}` // Αρχείο Α, Αρχείο Β, Αρχείο Γ
                : `Document ${String.fromCharCode(65 + index)}` // Document A, Document B, Document C
              : ''
            
            // For now, send full content until we implement proper chapter mode
            const fullContent = await extractContentFromUrl(
              contract.storageUrl,
              contract.fileType
            )
            
            const cachedMsg = {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${contractLabel}${contractLabel ? ' ' : ''}(${contract.file_name || 'Uploaded Contract'}): ${fullContent}`,
                  providerOptions: {
                    anthropic: { cacheControl: { type: 'ephemeral' } },
                  },
                },
              ],
            }
            cachedVaultFiles.push(cachedMsg)
          }
        }
        console.log(messages)

        // Default preferences if not provided
        const { includeGreekLaws = true, includeGreekCourtDecisions = false } =
          preferences || {}

        // Get the user's actual query from the last message
        const userQuery = messages[messages.length - 1].content
        console.log('User query extracted:', userQuery)

        // Detect chapter mode based on contract size or user request
        const isChapterMode = selectedVaultFiles?.[0]?.fileSize > 500000 || 
                            userQuery.toLowerCase().includes('chapter') ||
                            userQuery.toLowerCase().includes('κεφάλαιο')
        
        // Count approved chapters from message history
        const approvedChapters = messages.filter(
          (m: any) => m.role === 'assistant' && 
          (m.content.includes('Chapter') || m.content.includes('Κεφάλαιο'))
        ).length

        const selectedModel = await getLLMModel('claude-sonnet-4-6')
        console.log('Model loaded')

        // Build enhanced system prompt with mode and contract count
        let systemPrompt = CONTRACT_PROMPTS[locale]
        
        // Add mode information
        if (isChapterMode) {
          systemPrompt = systemPrompt.replace('{{MODE}}', 'CHAPTER')
          systemPrompt = systemPrompt.replace('{{CURRENT_CHAPTER}}', String(approvedChapters + 1))
        } else {
          systemPrompt = systemPrompt.replace('{{MODE}}', 'FULL')
          systemPrompt = systemPrompt.replace('{{CURRENT_CHAPTER}}', '')
        }
        
        // Add multi-contract information
        if (selectedVaultFiles && selectedVaultFiles.length > 1) {
          systemPrompt = systemPrompt.replace('{{TOTAL_CONTRACTS}}', String(selectedVaultFiles.length))
        } else {
          systemPrompt = systemPrompt.replace('{{TOTAL_CONTRACTS}}', '1')
        }

        systemPrompt += `\n\nTo provide comprehensive answers, always use the searchContractDocuments tool to retrieve information from both the contract documents and relevant legal sources. This will ensure you have access to the most up-to-date and relevant information for your responses.`
        
        console.log('System prompt constructed with mode:', isChapterMode ? 'CHAPTER' : 'FULL')

        const telemetrySettings = AISDKExporter.getSettings()
        const result = streamText({
          model: selectedModel,
          experimental_telemetry: telemetrySettings,
          experimental_continueSteps: true,
          maxTokens: maxOutputTokenSize,
          system: systemPrompt,
          providerOptions: getDefaultProviderOptions('medium'),
          tools: {
            searchContractDocuments: tool({
              description:
                'Search through uploaded contract documents for relevant information',
              parameters: z.object({
                query: z
                  .string()
                  .describe('Search query for contract documents'),
              }),
              execute: traceable(
                async ({ query }) => {
                  return 'Contract documents are attached in messages already'
                },
                { name: 'contract_search_documents', run_type: 'retriever' }
              ),
            }),
          },
          messages: convertToCoreMessages([
            ...cachedVaultFiles,
            ...messages,
          ]),
          async onFinish({
            text,
            toolCalls,
            toolResults,
            usage,
            finishReason,
          }) {
            console.log('Stream finished:', { finishReason, usage })
            data.close()
            if (
              finishReason !== 'tool-calls' &&
              finishReason !== 'content-filter'
            ) {
              if (subscriptionId) {
                await recordMessageUsage(subscriptionId)
              }
              revalidatePath(`/${locale}`, 'layout')
              revalidatePath(`/${locale}/contract/${contractId}`)
            }
          },
        })

        const runTree = getCurrentRunTree()
        const runId = runTree?.id ?? null

        return new Response(result.toDataStream(), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Run-Id': runId ?? '',
          },
        })
      } catch (error) {
        console.error('Error in route handler:', error)
        data.close()
        return new Response((error as any).message, { status: 500 })
      }
    },
    { name: 'contract_api_v1' }
  )()
}
