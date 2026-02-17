// lib/models/localLlmClient.ts
import { streamText as aiStreamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://localhost:8000'
const LLM_KEY = process.env.LLM_KEY || 'LLM_LLM'
const HF_MODEL = process.env.HF_MODEL_NAME || 'ilsp/Meltemi-7B-Instruct-v1.5'

// Create OpenAI-compatible client pointing to local LLM (Hugging Face)
const localLLM = createOpenAI({
  baseURL: `${LOCAL_LLM_URL}/v1`,
  apiKey: LLM_KEY,
})

export interface LocalLLMConfig {
  system: string
  messages: any[]
  maxTokens: number
  temperature?: number
  onFinish?: (event: { text: string; finishReason: string }) => Promise<void>
  onStepFinish?: (event: any) => Promise<void>
}

/**
 * Stream text from local LLM using OpenAI-compatible API
 * This maintains compatibility with Vercel AI SDK's streamText
 * Backend now uses Hugging Face Transformers with Meltemi-7B
 */
export async function streamTextFromLocalLLM(config: LocalLLMConfig) {
  console.log('🔄 Using LOCAL LLM (Hugging Face):', {
    url: LOCAL_LLM_URL,
    model: HF_MODEL,
    messagesCount: config.messages.length,
  })

  try {
    // Use Vercel AI SDK's streamText with our local provider
    const result = aiStreamText({
      model: localLLM(HF_MODEL) as any,
      system: config.system,
      messages: config.messages,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      onFinish: config.onFinish,
    })

    return result
  } catch (error) {
    console.error('❌ Local LLM (HF) error:', error)
    throw new Error(
      `Local LLM failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

/**
 * Check if local LLM is available
 */
export async function checkLocalLLMHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCAL_LLM_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return false

    const data = await response.json()
    const isHealthy = data.status === 'online' && data.model_status === 'loaded'

    if (isHealthy) {
      console.log('✅ Local LLM (HF) health check passed:', {
        status: data.status,
        model_status: data.model_status,
        model_name: data.model_name,
        device: data.device,
        cuda_available: data.cuda_available,
      })
    } else {
      console.warn('⚠️ Local LLM (HF) unhealthy:', data)
    }

    return isHealthy
  } catch (error) {
    console.error('❌ Local LLM (HF) health check failed:', error)
    return false
  }
}

/**
 * Execute tool-like behavior with local LLM
 * Since local LLMs don't support function calling well, we simulate it
 */
export async function executeToolWithLocalLLM(
  toolName: string,
  toolDescription: string,
  context: string,
  query: string
): Promise<string> {
  console.log(`🔧 Simulating tool execution with local LLM (HF): ${toolName}`)

  const toolPrompt = `You are executing a function called "${toolName}".

Description: ${toolDescription}

Context Information:
${context}

User Query: ${query}

Based on the context information provided above, answer the user's query thoroughly and accurately. Cite specific information from the context when relevant.`

  try {
    const result = aiStreamText({
      model: localLLM(HF_MODEL) as any,
      system: toolPrompt,
      messages: [{ role: 'user', content: query }],
      temperature: 0.3, // Lower temperature for factual retrieval
    })

    // Collect the full response
    const chunks: string[] = []
    for await (const chunk of result.textStream) {
      chunks.push(chunk)
    }

    return chunks.join('')
  } catch (error) {
    console.error('❌ Tool execution with local LLM (HF) failed:', error)
    throw error
  }
}

/**
 * Get available models from local LLM
 */
export async function getLocalLLMModels(): Promise<string[]> {
  try {
    const response = await fetch(`${LOCAL_LLM_URL}/v1/models`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LLM_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get models: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data?.map((m: any) => m.id) || []
  } catch (error) {
    console.error('❌ Failed to get local LLM (HF) models:', error)
    return []
  }
}

export const localLLMConfig = {
  url: LOCAL_LLM_URL,
  apiKey: LLM_KEY,
  model: HF_MODEL,
  provider: 'huggingface',
}
