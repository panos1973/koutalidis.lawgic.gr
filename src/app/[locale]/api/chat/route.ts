import { chatRateLimit, checkRateLimitOrRespond } from '@/lib/rateLimitResponse'
import { AISDKExporter } from 'langsmith/vercel'
import { VoyageAIClient, VoyageAI } from 'voyageai'
import { processResultsWithSelectiveUrls } from '@/lib/utils'
import { streamText, tool, convertToCoreMessages } from 'ai'
import {
  deduplicateAllSources,
  convertToExpectedFormat,
} from '@/lib/deduplication/lawDeduplication'
import { LAW_CHAT_PROMPTS } from '@/lib/prompts/law_chat'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import {
  addMessage,
  storePendingReferences,
  manageChatContext,
  getChatSummaries,
  getMessagesOfAchat,
} from '../../actions/chat_actions'
import { createLegalSummaryWithHaiku } from '@/lib/prompts/legal_summary'
import { temp_references, messages, chat_summaries } from '@/db/schema'
import { and, desc, eq, asc } from 'drizzle-orm'
import fs from 'fs/promises'
import path from 'path'
import {
  getCollectionStrings,
  MAX_FILE_CHARS,
  MAX_LAW_CHARACTERS_V2,
  MAX_PASTCASE_CHARACTERS,
  processUploadedFiles,
  retrieveAndFilterData,
  trimToTokenLimit,
  claudeAnalyzeQuery,
  localLlmAnalyzeQuery,
} from '@/lib/chatApiUtils'
import { z } from 'zod'
import { recordMessageUsage } from '../../actions/subscription'
import { revalidatePath } from 'next/cache'
import {
  extractContentFromUrl,
  searchLibraryFiles,
} from '../../actions/library_actions'
import {
  searchInternetForLegal,
  type StructuredPerplexityResults,
} from '@/lib/internetSearchUtils'
import {
  searchDeepSeekForLegal,
  deepSeekCircuitBreaker,
} from '@/lib/deepseekSearchUtils'
import { searchYouComForLegal } from '@/lib/youComSearchUtils'
import { retrieveCourtDecisionsFromWeaviate } from '@/lib/retrievers/weaviate_court_retriever'
import { retrieveLawsFromWeaviate } from '@/lib/retrievers/weaviate_law_retriever'
import { retrieveGraphContext } from '@/lib/retrievers/weaviate_graph_retriever'
import Anthropic from '@anthropic-ai/sdk'
import db from '@/db/drizzle'
import {
  streamTextFromLocalLLM,
  checkLocalLLMHealth,
} from '@/lib/models/localLlmClient'
import {
  classifyQuery,
  classifyQueryByPatterns,
  type QueryClassification,
} from '@/lib/queryClassifier'
import {
  getPipelineConfig,
  getPipelinePromptSuffix,
  getAdjustedBudgets,
  getAnthropicProviderOptions,
  type PipelineConfig,
} from '@/lib/pipelineConfig'

const USE_LOCAL_LLM = process.env.LOCAL_LLM === 'true'
console.log('====================================')
console.log('USING LOCAL:', USE_LOCAL_LLM)
console.log('====================================')
// Allow streaming responses up to 180 seconds
export const maxDuration = 180

// Sonnet 4.6 supports up to 64K output tokens; 16K is a good default for legal answers
const maxOutputTokenSize = 16384

// 🛠️ CRITICAL FIX: Make useVoyage control work properly
const useVoyage = false

// 🔥 TOKEN MANAGEMENT CONSTANTS
// Sonnet 4.6: 200K default context, 1M available in beta
const MAX_CONTEXT_TOKENS = 200000
const MAX_RECENT_MESSAGES = 3 // Reduced from 6 to 3 (1.5 exchanges)
const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'chat_api_logs.txt')

// 🛠️ CRITICAL FIX: Increased from 20 to 35 based on research findings
// Research shows 30-35 documents provide optimal balance of coverage and accuracy
const RERANKED_K = 35

const SAFE_FEATURES = {
  enableDateBoost: false,
  enableTemporalFilter: false,
  enableLawAwareFilter: false,
  enableDiversification: false,
}

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
const YOUCOM_API_KEY =
  process.env.YOUCOM_API_KEY || process.env.You_com_api || ''
const USE_YOUCOM = true
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const USE_DEEPSEEK = process.env.ENABLE_DEEPSEEK === 'true'

// 🔥 TOKEN ESTIMATION FUNCTION
function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 3.5 characters for mixed Greek/English legal text
  return Math.ceil(text.length / 3.5)
}

// 🔥 ENHANCED SYSTEM MESSAGE WITH CHAT SUMMARIES
async function buildEnhancedSystemMessage(
  baseSystemMessage: string,
  chatId: string,
  recentMessages: any[],
  locale: string,
  referencesContext: string,
  fileContentMessage: string
): Promise<{ enhancedMessage: string; tokenCount: number }> {
  // Get chat summaries for context
  const summaries = await getChatSummaries(chatId)

  let contextFromSummaries = ''
  if (summaries.length > 0) {
    const summariesText = summaries
      .slice(-2) // Use only last 2 summaries to save tokens
      .map((summary, index) => {
        return `Previous Context ${index + 1}:
Summary: ${summary.summary}
Key Topics: ${
          Array.isArray(summary.keyTopics)
            ? summary.keyTopics.join(', ')
            : summary.keyTopics
        }
Legal Context: ${summary.legalContext}`
      })
      .join('\n\n')

    contextFromSummaries =
      locale === 'el'
        ? `\n\nΠροηγούμενο Πλαίσιο Συνομιλίας:\n${summariesText}`
        : `\n\nPrevious Conversation Context:\n${summariesText}`
  }

  const enhancedMessage =
    baseSystemMessage +
    contextFromSummaries +
    referencesContext +
    fileContentMessage
  const tokenCount = estimateTokens(enhancedMessage)

  console.log('🔥 Enhanced system message built:', {
    summaries: summaries.length,
    systemTokens: tokenCount,
    hasSummaries: summaries.length > 0,
  })

  return { enhancedMessage, tokenCount }
}

// 🔥 SMART CONTEXT TRIMMING WITH PRIORITIZATION
function smartContextTrimming(
  documents: string[],
  maxTokens: number,
  preserveOrder: boolean = true
): string[] {
  const estimateTokens = (text: string) => Math.ceil(text.length / 3.5)
  let totalTokens = 0
  const result: string[] = []

  // If preserveOrder is false, sort by importance (look for recent dates, law references)
  let sortedDocs = documents
  if (!preserveOrder) {
    sortedDocs = [...documents].sort((a, b) => {
      const aScore =
        (a.match(/202[3-5]/g) || []).length +
        (a.match(/[Νν]\.\s*\d+\/\d{4}/g) || []).length
      const bScore =
        (b.match(/202[3-5]/g) || []).length +
        (b.match(/[Νν]\.\s*\d+\/\d{4}/g) || []).length
      return bScore - aScore // Higher score first
    })
  }

  for (const doc of sortedDocs) {
    const docTokens = estimateTokens(doc)
    if (totalTokens + docTokens <= maxTokens) {
      result.push(doc)
      totalTokens += docTokens
    } else {
      // Try to fit a trimmed version if we have space
      if (totalTokens < maxTokens * 0.9) {
        const remainingTokens = maxTokens - totalTokens
        const remainingChars = remainingTokens * 3.5
        let partialText = doc.substring(0, remainingChars)

        // Smart truncation at natural boundaries
        const paragraphBreak = partialText.lastIndexOf('\n\n')
        const sentenceBreak = Math.max(
          partialText.lastIndexOf('. '),
          partialText.lastIndexOf('; '),
          partialText.lastIndexOf('! '),
          partialText.lastIndexOf(': ')
        )

        if (paragraphBreak > partialText.length * 0.5) {
          partialText = partialText.substring(0, paragraphBreak + 2) + '...'
        } else if (sentenceBreak > partialText.length * 0.7) {
          partialText = partialText.substring(0, sentenceBreak + 1) + '...'
        } else {
          partialText += '...'
        }

        result.push(partialText)
        break
      }
      break
    }
  }

  console.log(
    `🔥 Smart trimming: ${documents.length} docs → ${result.length} docs, ${totalTokens} tokens`
  )
  return result
}

async function logToFile(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  try {
    await fs.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true })
    await fs.appendFile(LOG_FILE_PATH, logMessage)
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

async function tlogToFile(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  try {
    await fs.mkdir(
      path.dirname(path.join(process.cwd(), 'dump', 'chat_api_logs.txt')),
      { recursive: true }
    )
    await fs.appendFile(
      path.join(process.cwd(), 'dump', 'chat_api_logs.txt'),
      logMessage
    )
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

async function analyzeQueryIntent(query: string) {
  try {
    const currentTerms = [
      'current',
      'latest',
      'modern',
      'recent',
      'today',
      'now',
      'current law',
      'τρέχων',
      'τρέχουσα',
      'τρέχον',
      'πρόσφατος',
      'πρόσφατη',
      'σύγχρονος',
      'σύγχρονη',
      'σημερινός',
      'σήμερα',
      'τώρα',
      'ισχύων νόμος',
      'ισχύουσα νομοθεσία',
    ]
    const requiresCurrentLaw = currentTerms.some((term) =>
      query.toLowerCase().includes(term.toLowerCase())
    )
    return { requiresCurrentLaw }
  } catch (error) {
    console.error('Error analyzing query intent:', error)
    return { requiresCurrentLaw: true }
  }
}

function isUrlRequest(query: string): boolean {
  const urlKeywords = [
    'url',
    'σύνδεσμος',
    'σύνδεσμο',
    'διεύθυνση',
    'πού βρίσκω',
    'πού μπορώ να βρω',
    'link',
    'λινκ',
    'ιστοσελίδα',
    'site',
    'πηγή',
    'πηγές',
    'αναφορά',
    'αναφορές',
    'βρίσκεται',
    'βρίσκω',
    'ιστότοπος',
    'διαδίκτυο',
    'online',
    'where can I find',
    'link to',
    'url for',
    'website',
    'online version',
    'source',
    'reference',
    'where is',
    'find online',
    'web address',
  ]
  const queryLower = query.toLowerCase()
  return urlKeywords.some((keyword) =>
    queryLower.includes(keyword.toLowerCase())
  )
}

function combineAllSources(
  elasticsearchResults: {
    law_data?: any
    pastcase_data?: any
  },
  deepSeekResult: StructuredPerplexityResults | null,
  perplexityResult: StructuredPerplexityResults | null,
  youComResult: StructuredPerplexityResults | null
): {
  aiVersions: string[]
  fullReferences: string[]
  referenceTypes: string[]
} {
  const databaseResults: any[] = []

  if (
    elasticsearchResults?.law_data?.aiVersions &&
    Array.isArray(elasticsearchResults.law_data.aiVersions)
  ) {
    elasticsearchResults.law_data.aiVersions.forEach(
      (content: string, index: number) => {
        databaseResults.push({
          content,
          fullReference:
            elasticsearchResults.law_data.fullReferences?.[index] || '#',
          referenceType:
            elasticsearchResults.law_data.referenceTypes?.[index] ||
            'database_law',
        })
      }
    )
  }

  if (
    elasticsearchResults?.pastcase_data?.aiVersions &&
    Array.isArray(elasticsearchResults.pastcase_data.aiVersions)
  ) {
    elasticsearchResults.pastcase_data.aiVersions.forEach(
      (content: string, index: number) => {
        databaseResults.push({
          content,
          fullReference:
            elasticsearchResults.pastcase_data.fullReferences?.[index] || '#',
          referenceType:
            elasticsearchResults.pastcase_data.referenceTypes?.[index] ||
            'database_case',
        })
      }
    )
  }

  const deepSeekResults: any[] = []
  if (deepSeekResult && deepSeekResult.success) {
    if (
      deepSeekResult.legislation &&
      Array.isArray(deepSeekResult.legislation)
    ) {
      deepSeekResult.legislation.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          deepSeekResults.push({
            content: `**[DeepSeek] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'deepseek_legislation',
            confidence: item.confidence,
          })
        }
      })
    }

    if (
      deepSeekResult.jurisprudence &&
      Array.isArray(deepSeekResult.jurisprudence)
    ) {
      deepSeekResult.jurisprudence.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          deepSeekResults.push({
            content: `**[DeepSeek] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'deepseek_jurisprudence',
            confidence: item.confidence,
          })
        }
      })
    }

    if (
      deepSeekResult.developments &&
      Array.isArray(deepSeekResult.developments)
    ) {
      deepSeekResult.developments.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          deepSeekResults.push({
            content: `**[DeepSeek] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'deepseek_development',
            confidence: item.confidence,
          })
        }
      })
    }
  }

  const perplexityResults: any[] = []
  if (perplexityResult && perplexityResult.success) {
    if (
      perplexityResult.legislation &&
      Array.isArray(perplexityResult.legislation)
    ) {
      perplexityResult.legislation.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          perplexityResults.push({
            content: `**[Perplexity] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'perplexity_legislation',
            confidence: item.confidence,
          })
        }
      })
    }

    if (
      perplexityResult.jurisprudence &&
      Array.isArray(perplexityResult.jurisprudence)
    ) {
      perplexityResult.jurisprudence.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          perplexityResults.push({
            content: `**[Perplexity] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'perplexity_jurisprudence',
            confidence: item.confidence,
          })
        }
      })
    }

    if (
      perplexityResult.developments &&
      Array.isArray(perplexityResult.developments)
    ) {
      perplexityResult.developments.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          perplexityResults.push({
            content: `**[Perplexity] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'perplexity_development',
            confidence: item.confidence,
          })
        }
      })
    }
  }

  const youComResults: any[] = []
  if (youComResult && youComResult.success) {
    if (youComResult.legislation && Array.isArray(youComResult.legislation)) {
      youComResult.legislation.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          youComResults.push({
            content: `**[You.com] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'youcom_legislation',
            confidence: item.confidence,
          })
        }
      })
    }

    if (
      youComResult.jurisprudence &&
      Array.isArray(youComResult.jurisprudence)
    ) {
      youComResult.jurisprudence.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          youComResults.push({
            content: `**[You.com] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'youcom_jurisprudence',
            confidence: item.confidence,
          })
        }
      })
    }

    if (youComResult.developments && Array.isArray(youComResult.developments)) {
      youComResult.developments.forEach((item) => {
        if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
          youComResults.push({
            content: `**[You.com] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
            fullReference: item.url || '#',
            referenceType: 'youcom_development',
            confidence: item.confidence,
          })
        }
      })
    }
  }

  const recentEUDirectives: any[] = []
  const currentYear = new Date().getFullYear()

  ;[deepSeekResult, perplexityResult, youComResult].forEach((result) => {
    if (!result || !result.success) return

    const allContent = [
      ...(result.legislation || []),
      ...(result.jurisprudence || []),
      ...(result.developments || []),
    ]

    allContent.forEach((item) => {
      const euPattern = /(Directive|Οδηγία)\s+(\d{4})\/(\d+)/gi
      const matches = item.preview_text?.matchAll(euPattern) || []

      for (const match of matches) {
        const year = parseInt(match[2])
        if (year >= currentYear - 2) {
          recentEUDirectives.push({
            content: `**[EU Recent] ${item.title}**\n\n${item.preview_text}\n\n[Source: ${item.source_domain}](${item.url})`,
            fullReference: item.url || '#',
            referenceType: 'eu_directive_recent',
            confidence: 'high',
            year: year,
          })
        }
      }
    })
  })

  if (recentEUDirectives.length > 0) {
    databaseResults.unshift(...recentEUDirectives)
    console.log(
      `📌 Found ${recentEUDirectives.length} recent EU directives, prioritizing in results`
    )
  }

  console.log(
    `📊 Pre-deduplication counts: DB=${databaseResults.length}, DS=${deepSeekResults.length}, PX=${perplexityResults.length}, YC=${youComResults.length}`
  )

  const dedupResults = deduplicateAllSources(
    databaseResults,
    perplexityResults,
    deepSeekResults,
    youComResults
  )

  console.log(
    `✅ Deduplication complete: ${dedupResults.length} unique results from ${
      databaseResults.length +
      deepSeekResults.length +
      perplexityResults.length +
      youComResults.length
    } total`
  )

  const finalResults = convertToExpectedFormat(dedupResults)

  console.log('📊 Source contributions after deduplication:', {
    total: finalResults.aiVersions.length,
    database: finalResults.referenceTypes.filter((t) => t.includes('database'))
      .length,
    deepSeek: finalResults.referenceTypes.filter((t) => t.includes('deepseek'))
      .length,
    perplexity: finalResults.referenceTypes.filter((t) =>
      t.includes('perplexity')
    ).length,
    youCom: finalResults.referenceTypes.filter((t) => t.includes('youcom'))
      .length,
  })

  return finalResults
}

function detectMissingRecentLaws(
  results: any,
  query: string
): { warning?: string; suggestions: string[] } {
  const currentYear = new Date().getFullYear()
  let mostRecentYear = 0

  const yearPattern = /\b(20\d{2})\b/g
  const allText = JSON.stringify(results)
  const years = allText.matchAll(yearPattern)

  for (const match of years) {
    const year = parseInt(match[1])
    if (year > mostRecentYear && year <= currentYear) {
      mostRecentYear = year
    }
  }

  if (query.match(/επιτρέπεται|allowed|legal|μπορώ|may I|can I|is it legal/i)) {
    if (mostRecentYear < currentYear - 2) {
      return {
        warning: `Note: Latest information found is from ${mostRecentYear}. Recent developments may exist.`,
        suggestions: [
          'Check EUR-Lex for recent EU directives',
          'Verify with official government sources',
        ],
      }
    }
  }

  return { suggestions: [] }
}

function combineInternetResults(
  deepSeek: StructuredPerplexityResults | null,
  perplexity: StructuredPerplexityResults | null,
  youCom: StructuredPerplexityResults | null
): StructuredPerplexityResults | null {
  if (!deepSeek && !perplexity && !youCom) return null

  const sources = [deepSeek, perplexity, youCom].filter(Boolean)

  if (sources.length === 0) return null
  if (sources.length === 1) return sources[0]

  return {
    legislation: [
      ...(deepSeek?.legislation || []),
      ...(perplexity?.legislation || []),
      ...(youCom?.legislation || []),
    ],
    jurisprudence: [
      ...(deepSeek?.jurisprudence || []),
      ...(perplexity?.jurisprudence || []),
      ...(youCom?.jurisprudence || []),
    ],
    developments: [
      ...(deepSeek?.developments || []),
      ...(perplexity?.developments || []),
      ...(youCom?.developments || []),
    ],
    metadata: {
      totalResults:
        (deepSeek?.metadata.totalResults || 0) +
        (perplexity?.metadata.totalResults || 0) +
        (youCom?.metadata.totalResults || 0),
      searchQuery:
        deepSeek?.metadata.searchQuery ||
        perplexity?.metadata.searchQuery ||
        youCom?.metadata.searchQuery ||
        '',
      timestamp: new Date().toISOString(),
    },
    success: true,
  }
}

function detectPerplexityGaps(
  perplexityResults: StructuredPerplexityResults | null,
  existingLaws: string[],
  existingKeywords: string[]
): {
  hasNewContent: boolean
  newLaws: string[]
  newKeywords: string[]
  confidenceScore: number
} {
  if (!perplexityResults || !perplexityResults.success) {
    return {
      hasNewContent: false,
      newLaws: [],
      newKeywords: [],
      confidenceScore: 0,
    }
  }

  const newLaws: string[] = []
  const newKeywords: string[] = []

  const allPerplexityContent = [
    ...perplexityResults.legislation.map(
      (item) => `${item.title} ${item.preview_text}`
    ),
    ...perplexityResults.jurisprudence.map(
      (item) => `${item.title} ${item.preview_text}`
    ),
    ...perplexityResults.developments.map(
      (item) => `${item.title} ${item.preview_text}`
    ),
  ]
    .join(' ')
    .toLowerCase()

  const lawPatterns = [
    /ν\.\s*(\d+\/\d{4})/gi,
    /νόμος\s*(\d+\/\d{4})/gi,
    /ν(\d+\/\d{4})/gi,
    /πδ\.\s*(\d+\/\d{4})/gi,
    /υα\.\s*(\d+\/\d{4})/gi,
  ]

  lawPatterns.forEach((pattern) => {
    const matches = allPerplexityContent.match(pattern)
    if (matches) {
      matches.forEach((match) => {
        const normalizedMatch = match.trim().toUpperCase()
        const isNew = !existingLaws.some(
          (existingLaw) =>
            existingLaw.toUpperCase().includes(normalizedMatch) ||
            normalizedMatch.includes(existingLaw.toUpperCase())
        )

        if (isNew && !newLaws.includes(normalizedMatch)) {
          newLaws.push(normalizedMatch)
        }
      })
    }
  })

  const highValueTerms = [
    'απόλυση',
    'αποζημίωση',
    'μισθός',
    'άδεια',
    'σύμβαση',
    'εργαζόμενος',
    'εργοδότης',
    'παραγραφή',
    'αγωγή',
    'απόφαση',
    'δικαστήριο',
    'φόρος',
    'ΦΠΑ',
    'εισόδημα',
    'κυριότητα',
    'μίσθωση',
    'εταιρεία',
    'μετοχή',
    'ενέχυρο',
    'υποθήκη',
    'διοικητική πράξη',
    'ακύρωση',
    'αναστολή',
  ]

  highValueTerms.forEach((term) => {
    if (allPerplexityContent.includes(term.toLowerCase())) {
      const isNew = !existingKeywords.some(
        (existingKeyword) =>
          existingKeyword.toLowerCase() === term.toLowerCase()
      )

      if (isNew && !newKeywords.includes(term)) {
        newKeywords.push(term)
      }
    }
  })

  const totalNewItems = newLaws.length + newKeywords.length
  const hasHighConfidenceResults =
    perplexityResults.legislation.some((item) => item.confidence === 'high') ||
    perplexityResults.jurisprudence.some((item) => item.confidence === 'high')

  const confidenceScore = hasHighConfidenceResults
    ? Math.min(totalNewItems * 0.3, 1.0)
    : Math.min(totalNewItems * 0.2, 0.8)

  const hasNewContent = totalNewItems > 0 && confidenceScore > 0.3

  return {
    hasNewContent,
    newLaws: newLaws.slice(0, 3),
    newKeywords: newKeywords.slice(0, 5),
    confidenceScore,
  }
}

export async function POST(req: Request) {
  const {
    messages,
    chatId,
    locale,
    preferences,
    fileChunkIds,
    vaultFiles,
    isCached,
    userEmail,
    subscriptionId,
    searchInternet,
  } = await req.json()

  // Rate limit: 10 requests/minute per user
  const rateLimitKey = subscriptionId || userEmail || chatId || 'anonymous'
  const blocked = checkRateLimitOrRespond(chatRateLimit, rateLimitKey)
  if (blocked) return blocked

  try {
    await db
      .delete(temp_references)
      .where(
        and(
          eq(temp_references.chatId, chatId),
          eq(temp_references.status, 'pending')
        )
      )
    console.log('✅ Cleaned temp references for chatId:', chatId)
  } catch (error) {
    console.log('❌ Error cleaning temp references:', error)
  }

  try {
  const recentMessages = messages.slice(-MAX_RECENT_MESSAGES)

  console.log(
    `🔥 Token management: Using ${recentMessages.length} recent messages (from ${messages.length} total)`
  )

  const tempRefs: any = await db
    .select()
    .from(temp_references)
    .where(
      and(
        eq(temp_references.chatId, chatId),
        eq(temp_references.status, 'pending')
      )
    )
    .orderBy(desc(temp_references.createdAt))
    .limit(1)

  const uploadedFileData = await processUploadedFiles(chatId)

  let systemMessages = recentMessages

  if (
    uploadedFileData.chatFileDetails &&
    uploadedFileData.chatFileDetails.length > 0
  ) {
    const fileContents = uploadedFileData.chatFileDetails
      .map(
        (file) =>
          `Filename: ${
            file.filename
          }\nContent Preview: ${file.full_content.slice(0, MAX_FILE_CHARS)}...`
      )
      .join('\n\n')

    const initialSystemMessageIndex = recentMessages.findIndex(
      (msg: { role: string }) => msg.role === 'system'
    )

    if (initialSystemMessageIndex !== -1) {
      systemMessages = [...recentMessages]
      systemMessages[
        initialSystemMessageIndex
      ].content += `\n\nThe user has uploaded the following file(s). Use this information to gather important information and enhance your analysis:\n${fileContents}`
    } else {
      systemMessages = [
        {
          role: 'system',
          content: `The user has uploaded the following file(s). Use this information to gather important information and enhance your analysis:\n${fileContents}`,
        },
        ...recentMessages,
      ]
    }
  }

  const now = new Date()
  const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(
    now.getMonth() + 1
  )
    .toString()
    .padStart(2, '0')}/${now.getFullYear()}`

  const collectionStrings = getCollectionStrings(
    preferences,
    locale as 'en' | 'el'
  )

  const baseSystemMessage = LAW_CHAT_PROMPTS[locale as 'en' | 'el']
    .replace('{{currentDate}}', formattedDate)
    .replace('{{availableCollections}}', collectionStrings.availableCollections)
    .replace('{{searchInstructions}}', collectionStrings.searchInstructions)

  let referencesContext = ''
  const maxReferenceTokens = 1000

  if (tempRefs.length && tempRefs[0].refs) {
    referencesContext =
      locale === 'el'
        ? '\nΔιαθέσιμες αναφορές (παραθέστε αυτές συγκεκριμένα στην απάντησή σας):\n'
        : '\nAvailable references (cite these specifically in your answer):\n'

    referencesContext += tempRefs[0].refs
      .slice(0, 10)
      .map((ref: any) => {
        return `[${ref.ref_sequence}] Type: ${
          ref.reference_type || 'unknown'
        }, Citation: ${ref.court || ''} ${ref.decision_number || ''} ${
          ref.decision_date || ''
        }`
      })
      .join('\n')

    if (referencesContext.length > maxReferenceTokens) {
      referencesContext =
        referencesContext.substring(0, maxReferenceTokens) + '...'
    }
  }

  const fileContentMessage =
    uploadedFileData.chatFileDetails?.length > 0
      ? `\n\n${
          locale === 'el'
            ? 'Περιεχόμενο Μεταφορτωμένων Αρχείων'
            : 'Uploaded File Content'
        }:\n${uploadedFileData.chatFileDetails
          .map((file) => `### ${file.filename} ###\n${file.full_content}`)
          .join('\n\n')}`
      : ''

  const { enhancedMessage: enhancedSystemMessage, tokenCount: systemTokens } =
    await buildEnhancedSystemMessage(
      baseSystemMessage,
      chatId,
      recentMessages,
      locale,
      referencesContext,
      fileContentMessage
    )

  const userQuery = recentMessages[recentMessages.length - 1].content
  console.log('User query extracted:', userQuery)

  // ── STAGE 0: Query Classification & Pipeline Routing ──────────────────
  // Classify query to determine optimal pipeline strategy
  // Uses Haiku (~200ms, ~$0.0002) with pattern-based fallback
  let queryClassification: QueryClassification
  try {
    // Run classifier in parallel with non-dependent setup work
    queryClassification = USE_LOCAL_LLM
      ? classifyQueryByPatterns(userQuery) // Skip API call for local LLM mode
      : await classifyQuery(userQuery)
  } catch (classificationError) {
    console.warn(
      '[Pipeline] Classification failed, defaulting to simple_lookup:',
      classificationError
    )
    queryClassification = classifyQueryByPatterns(userQuery)
  }

  const pipelineConfig = getPipelineConfig(queryClassification)
  const pipelinePromptSuffix = getPipelinePromptSuffix(pipelineConfig, locale)

  console.log(
    `[Pipeline] Route: ${pipelineConfig.pipelineLabel} | Type: ${queryClassification.queryType} | Confidence: ${queryClassification.confidence}`
  )
  console.log(
    `[Pipeline] Detected laws: ${queryClassification.detectedLaws.join(', ') || 'none'}`
  )
  console.log(
    `[Pipeline] Config: discovery=${!pipelineConfig.skipDiscoverySearch}, secondPass=${pipelineConfig.enableSecondPassSearch}, contra=${pipelineConfig.enableContraSearch}`
  )
  // ── END Query Classification ──────────────────────────────────────────

  const conversationTokens = estimateTokens(JSON.stringify(systemMessages))
  const totalCurrentTokens = systemTokens + conversationTokens

  console.log(
    `🔥 Current token usage: System=${systemTokens}, Messages=${conversationTokens}, Total=${totalCurrentTokens}`
  )

  if (totalCurrentTokens > MAX_CONTEXT_TOKENS * 0.8) {
    console.log('⚠️ High token usage detected, will use aggressive trimming')
  }

  let cachedVaultFiles: any[] = []
  if (!isCached && vaultFiles) {
    for (const contract of vaultFiles) {
      const cleanedFiles = await extractContentFromUrl(
        contract.storageUrl,
        contract.fileType
      )
      console.log(cleanedFiles)
      const cachedMsg = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Files from user vault, use this to enhance the answers, take them to consideration while answering - ${cleanedFiles}`,
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          },
        ],
      }
      cachedVaultFiles.push(cachedMsg)
    }
  }

  // Append pipeline-specific instructions to the system message
  const pipelineEnhancedSystemMessage =
    enhancedSystemMessage + pipelinePromptSuffix

  // Calculate adjusted budgets based on pipeline config
  const adjustedBudgets = getAdjustedBudgets(
    pipelineConfig,
    MAX_LAW_CHARACTERS_V2,
    MAX_PASTCASE_CHARACTERS,
    RERANKED_K
  )

  console.log(`[Pipeline] Adjusted budgets:`, {
    maxLawChars: adjustedBudgets.maxLawChars,
    maxCaseChars: adjustedBudgets.maxCaseChars,
    rerankTopK: adjustedBudgets.rerankTopK,
  })

  let result

  if (USE_LOCAL_LLM) {
    console.log('🤖 Using LOCAL LLM - executing searches first')

    const isHealthy = await checkLocalLLMHealth()
    if (!isHealthy) {
      return new Response(JSON.stringify({ error: 'Local LLM unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let combined_ai_versions: string[] = []
    let combined_references: string[] = []
    let combined_reference_types: string[] = []

    const queryIntent = await analyzeQueryIntent(userQuery)

    // Use LOCAL LLM for analysis instead of Claude
    let enhancedAnalysis = null
    try {
      console.log(
        '🧠 Starting LOCAL LLM analysis for query:',
        userQuery.substring(0, 100) + '...'
      )
      enhancedAnalysis = await localLlmAnalyzeQuery(userQuery)
      console.log('✅ Local LLM analysis completed:', enhancedAnalysis)
    } catch (error) {
      console.log('❌ Local LLM analysis failed, using basic analysis')
      enhancedAnalysis = null
    }

    const combinedQueryIntent = {
      ...queryIntent,
      legalCategories: enhancedAnalysis?.legalCategories || ['γενικό'],
      keywords: [...(enhancedAnalysis?.keywords || []), 'ισχύον', 'τρέχων'],
      enhancedLaws: enhancedAnalysis?.detectedLaws || [],
      enhancedTemporal: enhancedAnalysis?.temporalIntent || true,
      analysisConfidence: enhancedAnalysis?.confidence || 'low',
    }

    console.log(
      `🚀 [${pipelineConfig.pipelineLabel}] Starting searches - ES:${
        preferences.includeGreekLaws || preferences.includeGreekCourtDecisions
      } PX:${!!PERPLEXITY_API_KEY} DS:${USE_DEEPSEEK} YC:${USE_YOUCOM}`
    )
    const parallelStartTime = Date.now()

    let law_data: any = null
    let pastcase_data: any = null
    let deepSeekResult: StructuredPerplexityResults | null = null
    let perplexityResult: StructuredPerplexityResults | null = null
    let youComResult: StructuredPerplexityResults | null = null

    const allSearchPromises: Promise<void>[] = []

    // Helper: retrieve laws from Weaviate GreekLegalDocuments with Elasticsearch fallback
    const retrieveLaws = async (query: string, maxChars: number) => {
      try {
        console.log('📚 Attempting Weaviate law retrieval (GreekLegalDocuments)...')
        const weaviateResults = await retrieveLawsFromWeaviate(query, maxChars)
        if (weaviateResults.aiVersions.length > 0) {
          console.log(`✅ Weaviate law retrieval: ${weaviateResults.aiVersions.length} results`)
          return weaviateResults
        }
        console.log('⚠️ Weaviate law search returned no results, falling back to Elasticsearch')
      } catch (error) {
        console.warn('⚠️ Weaviate law retrieval failed, falling back to Elasticsearch:', error)
      }
      return retrieveAndFilterData(query, 'greek_laws_collection', maxChars, 'voyage-3.5')
    }

    // Helper: retrieve court decisions from Weaviate with Elasticsearch fallback
    const retrieveCourtDecisions = async (maxChars: number) => {
      try {
        console.log('📚 Attempting Weaviate court retrieval...')
        const weaviateResults = await retrieveCourtDecisionsFromWeaviate(userQuery, maxChars)
        if (weaviateResults.aiVersions.length > 0) {
          console.log(`✅ Weaviate court retrieval: ${weaviateResults.aiVersions.length} results`)
          return weaviateResults
        }
        console.log('⚠️ Weaviate returned no results, falling back to Elasticsearch')
      } catch (error) {
        console.warn('⚠️ Weaviate court retrieval failed, falling back to Elasticsearch:', error)
      }
      return retrieveAndFilterData(userQuery, 'dev_greek_court', maxChars, undefined)
    }

    // Helper: retrieve graph context for temporal/amendment queries
    const retrieveGraphContextIfNeeded = async (): Promise<string> => {
      if (
        queryClassification.queryType !== 'temporal' ||
        queryClassification.detectedLaws.length === 0
      ) {
        return ''
      }
      try {
        console.log(`📊 Building graph context for temporal query (laws: ${queryClassification.detectedLaws.join(', ')})`)
        const graphParts: string[] = []
        // Build graph context for each detected law (limit to first 3)
        for (const lawRef of queryClassification.detectedLaws.slice(0, 3)) {
          const lawNumber = lawRef.match(/(\d+\/\d{4})/)?.[1]
          if (!lawNumber) continue
          const graphContext = await retrieveGraphContext(lawNumber, undefined, 30000)
          if (graphContext.aiVersions.length > 0) {
            graphParts.push(...graphContext.aiVersions)
          }
        }
        if (graphParts.length > 0) {
          console.log(`✅ Graph context built: ${graphParts.length} law graph(s)`)
          return '\n\n' + graphParts.join('\n\n')
        }
      } catch (error) {
        console.warn('⚠️ Graph context retrieval failed:', error)
      }
      return ''
    }

    if (
      preferences.includeGreekLaws &&
      preferences.includeGreekCourtDecisions
    ) {
      allSearchPromises.push(
        (async () => {
          try {
            const balancedMaxLawChars = adjustedBudgets.maxLawChars
            const balancedMaxCaseChars = Math.floor(adjustedBudgets.maxCaseChars / 2)

            const [lawResults, caseResults] = await Promise.all([
              retrieveLaws(userQuery, balancedMaxLawChars),
              retrieveCourtDecisions(balancedMaxCaseChars),
            ])

            law_data = lawResults
            pastcase_data = caseResults
            console.log('✅ [Weaviate+ES] Data retrieval completed')
          } catch (error) {
            console.error('❌ Data retrieval failed:', error)
          }
        })()
      )
    } else if (preferences.includeGreekLaws) {
      allSearchPromises.push(
        (async () => {
          try {
            law_data = await retrieveLaws(userQuery, adjustedBudgets.maxLawChars)
            console.log('✅ Weaviate/ES law search completed')
          } catch (error) {
            console.error('❌ [ES] Law search failed:', error)
          }
        })()
      )
    } else if (preferences.includeGreekCourtDecisions) {
      allSearchPromises.push(
        (async () => {
          try {
            pastcase_data = await retrieveCourtDecisions(adjustedBudgets.maxCaseChars)
            console.log('✅ Court decisions retrieval completed')
          } catch (error) {
            console.error('❌ Case search failed:', error)
          }
        })()
      )
    }

    if (USE_DEEPSEEK && DEEPSEEK_API_KEY) {
      allSearchPromises.push(
        (async () => {
          try {
            if (deepSeekCircuitBreaker.isOpen()) {
              console.log(`⚡ [DS] Circuit breaker OPEN, skipping...`)
              return
            }

            const result = await Promise.race([
              searchDeepSeekForLegal(userQuery),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('DeepSeek timeout')), 30000)
              ),
            ])

            if (result && typeof result === 'object' && 'success' in result) {
              deepSeekResult = result as StructuredPerplexityResults
              console.log(`✅ [DS] DeepSeek completed`)
            }
          } catch (error) {
            console.error('❌ [DS] DeepSeek failed:', error)
          }
        })()
      )
    }

    if (PERPLEXITY_API_KEY) {
      allSearchPromises.push(
        (async () => {
          try {
            const result = await Promise.race([
              searchInternetForLegal(userQuery),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Perplexity timeout')), 60000)
              ),
            ])

            if (result && typeof result === 'object' && 'success' in result) {
              perplexityResult = result as StructuredPerplexityResults
              console.log(`✅ [PX] Perplexity completed`)
            }
          } catch (error) {
            console.error('❌ [PX] Perplexity failed:', error)
          }
        })()
      )
    }

    if (USE_YOUCOM && YOUCOM_API_KEY) {
      allSearchPromises.push(
        (async () => {
          try {
            const result = await Promise.race([
              searchYouComForLegal(userQuery),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('You.com timeout')), 35000)
              ),
            ])

            if (result && typeof result === 'object' && 'success' in result) {
              youComResult = result as StructuredPerplexityResults
              console.log(`✅ [YC] You.com completed`)
            }
          } catch (error) {
            console.error('❌ [YC] You.com failed:', error)
          }
        })()
      )
    }

    // Add graph context retrieval for temporal queries (runs in parallel with other searches)
    let graphContextResult = ''
    allSearchPromises.push(
      (async () => {
        try {
          graphContextResult = await retrieveGraphContextIfNeeded()
        } catch (error) {
          console.warn('⚠️ Graph context retrieval failed:', error)
        }
      })()
    )

    await Promise.allSettled(allSearchPromises)
    console.log(
      `⏱️ All searches completed in ${Date.now() - parallelStartTime}ms`
    )

    const combinedResults = combineAllSources(
      { law_data, pastcase_data },
      deepSeekResult,
      perplexityResult,
      youComResult
    )

    combined_ai_versions = combinedResults.aiVersions
    combined_references = combinedResults.fullReferences
    combined_reference_types = combinedResults.referenceTypes

    // Inject graph context (amendment chains, version history) into law results
    if (graphContextResult) {
      console.log(`📊 Injecting graph context (${graphContextResult.length} chars) into results`)
      combined_ai_versions.unshift(graphContextResult)
      combined_references.unshift(graphContextResult)
      combined_reference_types.unshift('weaviate_graph')
    }

    if (fileChunkIds && fileChunkIds.length > 0) {
      const result = await searchLibraryFiles(userQuery, fileChunkIds)
      const finalResult =
        locale === 'el'
          ? `Αυτά είναι τα αποτελέσματα αναζήτησης από τα έγγραφα του χρήστη: ${result}`
          : `These are the user library documents search results: ${result}`
      combined_ai_versions.push(finalResult)
    }

    const reservedForOutput = maxOutputTokenSize + 2000
    const maxTokensForDocs =
      MAX_CONTEXT_TOKENS - totalCurrentTokens - reservedForOutput

    // Apply reranking if enabled
    let finalSearchResults = combined_ai_versions

    if (useVoyage && combined_ai_versions.length > 0) {
      try {
        const voyageClient = new VoyageAIClient({
          apiKey: process.env.VOYAGE_API_KEY!,
        })

        const dynamicTopK = Math.min(
          RERANKED_K,
          combined_ai_versions.length,
          Math.floor(maxTokensForDocs / 3000)
        )

        const voyage_results: VoyageAI.RerankResponse =
          await voyageClient.rerank({
            model: 'rerank-2.5-lite',
            query: userQuery,
            documents: combined_ai_versions,
            topK: dynamicTopK,
          })

        let ranked_results = voyage_results.data
          ?.map((result) => {
            if (
              typeof result.index === 'number' &&
              combined_ai_versions[result.index]
            ) {
              return combined_ai_versions[result.index]
            }
            return undefined
          })
          .filter((item): item is string => item !== undefined)

        if (ranked_results) {
          ranked_results = smartContextTrimming(
            ranked_results,
            Math.floor(maxTokensForDocs / 3.5),
            false
          )
          const ranked_reference_types = ranked_results.map((aiVersion) => {
            const index = combined_ai_versions.indexOf(aiVersion)
            return index !== -1 ? combined_reference_types[index] : 'unknown'
          })

          finalSearchResults = processResultsWithSelectiveUrls(
            ranked_results,
            ranked_reference_types
          )

          const ranked_references = ranked_results
            .map((aiVersion) => {
              const index = combined_ai_versions.indexOf(aiVersion)
              return index !== -1
                ? {
                    reference: combined_references[index],
                    type: combined_reference_types[index],
                  }
                : null
            })
            .filter(
              (ref): ref is { reference: string; type: string } => ref !== null
            )

          await storePendingReferences(
            chatId,
            ranked_references.map((r) => r.reference),
            ranked_references.map((r) => r.type)
          )

          console.log(
            `✅ VoyageAI reranking successful: ${finalSearchResults.length} results`
          )
        }
      } catch (e) {
        console.error('❌ Voyage rerank error:', e)
        const maxDocsWithoutReranking = Math.floor(maxTokensForDocs / 4000)
        finalSearchResults = smartContextTrimming(
          combined_ai_versions.slice(0, maxDocsWithoutReranking * 2),
          Math.floor(maxTokensForDocs / 3.5),
          false
        )
      }
    } else {
      const maxDocsWithoutReranking = Math.floor(maxTokensForDocs / 4000)
      finalSearchResults = smartContextTrimming(
        combined_ai_versions.slice(0, maxDocsWithoutReranking * 2),
        Math.floor(maxTokensForDocs / 3.5),
        false
      )

      await storePendingReferences(
        chatId,
        combined_references.slice(0, finalSearchResults.length),
        combined_reference_types.slice(0, finalSearchResults.length)
      )
    }

    console.log(
      `🤖 Local LLM receiving ${finalSearchResults.length} search results`
    )

    // Inject search results into messages for local LLM
    const contextMessage =
      finalSearchResults.length > 0
        ? `\n\nRelevant legal documents and information:\n\n${finalSearchResults.join(
            '\n\n---\n\n'
          )}`
        : ''

    const enrichedMessages = convertToCoreMessages(
      cachedVaultFiles.length > 0
        ? [...cachedVaultFiles, ...systemMessages]
        : systemMessages
    )

    // Add context to the last user message
    if (enrichedMessages.length > 0) {
      const lastMessage = enrichedMessages[enrichedMessages.length - 1]
      if (lastMessage.role === 'user') {
        lastMessage.content = lastMessage.content + contextMessage
      }
    }

    result = await streamTextFromLocalLLM({
      system: pipelineEnhancedSystemMessage,
      messages: enrichedMessages,
      maxTokens: maxOutputTokenSize,
      temperature: 0.7,
      onFinish: async (event) => {
        const messageContent = event.text || ''
        if (userEmail && subscriptionId && messageContent.trim() !== '') {
          await recordMessageUsage(subscriptionId)
        }
        revalidatePath('/dashboard', 'layout')
        if (chatId && messageContent.trim() !== '') {
          await addMessage(chatId, 'user', userQuery)
          await addMessage(chatId, 'assistant', messageContent)

          try {
            const allMessages = await getMessagesOfAchat(chatId)

            if (allMessages.length >= 4 && allMessages.length % 2 === 0) {
              console.log(
                '🔥 Creating legal summary using specialized function'
              )

              const legalSummary = await createLegalSummaryWithHaiku(
                userQuery,
                messageContent,
                locale as 'en' | 'el'
              )

              console.log(
                '✅ Legal summary created:',
                legalSummary.substring(0, 100) + '...'
              )

              await db.insert(chat_summaries).values({
                chatId,
                summary: legalSummary,
                keyTopics: [],
                legalContext: legalSummary,
                messageRangeStart: allMessages.length - 2,
                messageRangeEnd: allMessages.length - 1,
              })

              console.log('📚 Legal summary stored in database')
            }

            await manageChatContext(chatId, allMessages, locale)
            console.log(
              `🔥 Chat context managed for ${allMessages.length} total messages`
            )
          } catch (contextError) {
            console.error('❌ Failed to manage chat context:', contextError)
          }
        }
      },
    })
  } else {
    console.log('🧠 Using CLAUDE')

    const selectedModel = await getLLMModel('claude-sonnet-4-6')
    const telemetrySettings = AISDKExporter.getSettings({
      metadata: { userEmail, userQuery },
      runName: 'athena_api_v1',
    })

    // Build Sonnet 4.6 thinking & effort options based on pipeline classification
    const anthropicOptions = getAnthropicProviderOptions(pipelineConfig)
    console.log(
      `[Pipeline] Anthropic options: effort=${pipelineConfig.effort}, adaptiveThinking=${pipelineConfig.enableAdaptiveThinking}`
    )

    result = streamText({
      model: selectedModel,
      system: pipelineEnhancedSystemMessage,
      maxTokens: maxOutputTokenSize,
      experimental_telemetry: telemetrySettings,
      experimental_continueSteps: true,
      providerOptions: anthropicOptions,
      tools: {
        answerLawQuestions: tool({
          description:
            'Answers questions related to Laws, Past Cases, Legal Articles and Bibliography.',
          parameters: z.object({
            query: z
              .string()
              .describe(
                'Exact user query as provided without modifications, paraphrasing, or any other alterations. Include the current date for temporal context: {{currentDate}}'
              ),
          }),
          execute: async ({ query }) => {
            let combined_ai_versions: string[] = []
            let combined_references: string[] = []
            let combined_reference_types: string[] = []

            const queryIntent = await analyzeQueryIntent(userQuery)

            let enhancedAnalysis = null
            try {
              console.log(
                '🧠 Starting Claude analysis for query:',
                userQuery.substring(0, 100) + '...'
              )
              enhancedAnalysis = await claudeAnalyzeQuery(userQuery)
              console.log('✅ Claude analysis completed:', {
                categories: enhancedAnalysis.legalCategories,
                keywords: enhancedAnalysis.keywords,
                laws: enhancedAnalysis.detectedLaws,
                temporal: enhancedAnalysis.temporalIntent,
                confidence: enhancedAnalysis.confidence,
              })
            } catch (error) {
              console.log(
                '❌ Claude analysis failed, using basic analysis:',
                error instanceof Error ? error.message : String(error)
              )
              enhancedAnalysis = null
            }

            const combinedQueryIntent = {
              ...queryIntent,
              legalCategories: enhancedAnalysis?.legalCategories || ['γενικό'],
              keywords: [
                ...(enhancedAnalysis?.keywords || []),
                'ισχύον',
                'τρέχων',
              ],
              enhancedLaws: [],
              enhancedTemporal: true,
              analysisConfidence: enhancedAnalysis?.confidence || 'low',
            }

            console.log('🎯 Combined query analysis:', {
              basicRequiresCurrentLaw: queryIntent.requiresCurrentLaw,
              enhancedTemporal: combinedQueryIntent.enhancedTemporal,
              enhancedLaws: combinedQueryIntent.enhancedLaws,
              keywords: combinedQueryIntent.keywords,
              confidence: combinedQueryIntent.analysisConfidence,
            })

            console.log(
              `🚀 Starting searches - ES:${
                preferences.includeGreekLaws ||
                preferences.includeGreekCourtDecisions
              } PX:${!!PERPLEXITY_API_KEY} DS:${USE_DEEPSEEK} YC:${USE_YOUCOM}`
            )
            const parallelStartTime = Date.now()

            let law_data: any = null
            let pastcase_data: any = null
            let deepSeekResult: StructuredPerplexityResults | null = null
            let perplexityResult: StructuredPerplexityResults | null = null
            let youComResult: StructuredPerplexityResults | null = null

            const allSearchPromises: Promise<void>[] = []

            // Helper: retrieve laws from Weaviate with Elasticsearch fallback (tool path)
            const retrieveLawsTool = async (query: string, maxChars: number) => {
              try {
                console.log('📚 Attempting Weaviate law retrieval (tool)...')
                const weaviateResults = await retrieveLawsFromWeaviate(query, maxChars)
                if (weaviateResults.aiVersions.length > 0) {
                  console.log(`✅ Weaviate law retrieval (tool): ${weaviateResults.aiVersions.length} results`)
                  return weaviateResults
                }
                console.log('⚠️ Weaviate law search returned no results, falling back to Elasticsearch')
              } catch (error) {
                console.warn('⚠️ Weaviate law retrieval failed, falling back to Elasticsearch:', error)
              }
              return retrieveAndFilterData(query, 'greek_laws_collection', maxChars, 'voyage-3.5')
            }

            // Helper: retrieve court decisions from Weaviate with Elasticsearch fallback (tool path)
            const retrieveCourtDecisionsTool = async (maxChars: number) => {
              try {
                console.log('📚 Attempting Weaviate court retrieval (tool)...')
                const weaviateResults = await retrieveCourtDecisionsFromWeaviate(userQuery, maxChars)
                if (weaviateResults.aiVersions.length > 0) {
                  console.log(`✅ Weaviate court retrieval: ${weaviateResults.aiVersions.length} results`)
                  return weaviateResults
                }
                console.log('⚠️ Weaviate returned no results, falling back to Elasticsearch')
              } catch (error) {
                console.warn('⚠️ Weaviate court retrieval failed, falling back to Elasticsearch:', error)
              }
              return retrieveAndFilterData(userQuery, 'dev_greek_court', maxChars, undefined)
            }

            if (
              preferences.includeGreekLaws &&
              preferences.includeGreekCourtDecisions
            ) {
              allSearchPromises.push(
                (async () => {
                  try {
                    const balancedMaxLawChars = adjustedBudgets.maxLawChars
                    const balancedMaxCaseChars = Math.floor(
                      adjustedBudgets.maxCaseChars / 2
                    )

                    const [lawResults, caseResults] = await Promise.all([
                      retrieveLawsTool(userQuery, balancedMaxLawChars),
                      retrieveCourtDecisionsTool(balancedMaxCaseChars),
                    ])

                    law_data = lawResults
                    pastcase_data = caseResults
                    console.log('✅ [Weaviate+ES] Data retrieval completed (tool)')
                  } catch (error) {
                    console.error('❌ Data retrieval failed (tool):', error)
                  }
                })()
              )
            } else if (preferences.includeGreekLaws) {
              allSearchPromises.push(
                (async () => {
                  try {
                    law_data = await retrieveLawsTool(userQuery, adjustedBudgets.maxLawChars)
                    console.log('✅ Weaviate/ES law search completed (tool)')
                  } catch (error) {
                    console.error('❌ [ES] Law search failed:', error)
                  }
                })()
              )
            } else if (preferences.includeGreekCourtDecisions) {
              allSearchPromises.push(
                (async () => {
                  try {
                    pastcase_data = await retrieveCourtDecisionsTool(adjustedBudgets.maxCaseChars)
                    console.log('✅ Court decisions retrieval completed')
                  } catch (error) {
                    console.error('❌ Case search failed:', error)
                  }
                })()
              )
            }

            if (USE_DEEPSEEK && DEEPSEEK_API_KEY) {
              allSearchPromises.push(
                (async () => {
                  try {
                    if (deepSeekCircuitBreaker.isOpen()) {
                      const status = deepSeekCircuitBreaker.getStatus()
                      console.log(
                        `⚡ [DS] Circuit breaker OPEN until ${new Date(
                          status.openUntil
                        ).toISOString()}, skipping...`
                      )
                      return
                    }

                    const searchPromise = searchDeepSeekForLegal(userQuery)

                    const timeoutPromise =
                      new Promise<StructuredPerplexityResults | null>(
                        (_, reject) => {
                          setTimeout(() => {
                            reject(
                              new Error('DeepSeek timeout after 30 seconds')
                            )
                          }, 30000)
                        }
                      )

                    const result = await Promise.race([
                      searchPromise,
                      timeoutPromise,
                    ])

                    if (
                      result &&
                      typeof result === 'object' &&
                      'success' in result
                    ) {
                      deepSeekResult = result as StructuredPerplexityResults
                      const total =
                        (deepSeekResult.legislation?.length || 0) +
                        (deepSeekResult.jurisprudence?.length || 0) +
                        (deepSeekResult.developments?.length || 0)
                      console.log(
                        `✅ [DS] DeepSeek completed with ${total} total results`
                      )
                    } else {
                      console.warn(
                        '⚠️ [DS] DeepSeek returned unexpected format'
                      )
                    }
                  } catch (error) {
                    console.error(
                      '❌ [DS] DeepSeek failed:',
                      error instanceof Error ? error.message : String(error)
                    )

                    if (
                      error instanceof Error &&
                      error.message.includes('timeout')
                    ) {
                      deepSeekCircuitBreaker.recordTimeout()
                      console.warn(
                        '📊 [DS] Timeout recorded to circuit breaker'
                      )
                    }
                  }
                })()
              )
            }

            if (PERPLEXITY_API_KEY) {
              allSearchPromises.push(
                (async () => {
                  try {
                    const searchPromise = searchInternetForLegal(userQuery)
                    const timeoutPromise =
                      new Promise<StructuredPerplexityResults | null>(
                        (_, reject) => {
                          setTimeout(() => {
                            reject(
                              new Error('Perplexity timeout after 60 seconds')
                            )
                          }, 60000)
                        }
                      )

                    const result = await Promise.race([
                      searchPromise,
                      timeoutPromise,
                    ])

                    if (
                      result &&
                      typeof result === 'object' &&
                      'success' in result
                    ) {
                      perplexityResult = result as StructuredPerplexityResults
                      const total =
                        (perplexityResult.legislation?.length || 0) +
                        (perplexityResult.jurisprudence?.length || 0) +
                        (perplexityResult.developments?.length || 0)
                      console.log(
                        `✅ [PX] Perplexity completed with ${total} total results`
                      )
                    } else {
                      console.warn(
                        '⚠️ [PX] Perplexity returned unexpected format'
                      )
                    }
                  } catch (error) {
                    console.error(
                      '❌ [PX] Perplexity failed:',
                      error instanceof Error ? error.message : String(error)
                    )
                  }
                })()
              )
            }

            if (USE_YOUCOM && YOUCOM_API_KEY) {
              allSearchPromises.push(
                (async () => {
                  try {
                    const searchPromise = searchYouComForLegal(userQuery)

                    const timeoutPromise =
                      new Promise<StructuredPerplexityResults | null>(
                        (_, reject) => {
                          setTimeout(() => {
                            reject(
                              new Error('You.com timeout after 35 seconds')
                            )
                          }, 35000)
                        }
                      )

                    const result = await Promise.race([
                      searchPromise,
                      timeoutPromise,
                    ])

                    if (
                      result &&
                      typeof result === 'object' &&
                      'success' in result
                    ) {
                      youComResult = result as StructuredPerplexityResults
                      const total =
                        (youComResult.legislation?.length || 0) +
                        (youComResult.jurisprudence?.length || 0) +
                        (youComResult.developments?.length || 0)
                      console.log(
                        `✅ [YC] You.com completed with ${total} total results`
                      )
                    } else {
                      console.warn('⚠️ [YC] You.com returned unexpected format')
                    }
                  } catch (error) {
                    console.error(
                      '❌ [YC] You.com failed:',
                      error instanceof Error ? error.message : String(error)
                    )
                  }
                })()
              )
            }

            console.log(
              `🚀 Executing ${allSearchPromises.length} searches in PARALLEL...`
            )
            await Promise.allSettled(allSearchPromises)
            console.log(
              `⏱️ All searches completed in ${Date.now() - parallelStartTime}ms`
            )

            console.log('=== SEARCH RESULTS SUMMARY ===')
            console.log('Elasticsearch:', {
              laws: (law_data as any)?.aiVersions?.length || 0,
              cases: (pastcase_data as any)?.aiVersions?.length || 0,
            })

            const typedDeepSeek =
              deepSeekResult as StructuredPerplexityResults | null
            if (typedDeepSeek && typedDeepSeek.success) {
              console.log('DeepSeek Results:', {
                success: true,
                legislation: typedDeepSeek.legislation?.length || 0,
                jurisprudence: typedDeepSeek.jurisprudence?.length || 0,
                developments: typedDeepSeek.developments?.length || 0,
              })
            } else {
              console.log('DeepSeek Results:', { success: false })
            }

            const typedPerplexity =
              perplexityResult as StructuredPerplexityResults | null
            if (typedPerplexity && typedPerplexity.success) {
              console.log('Perplexity Results:', {
                success: true,
                legislation: typedPerplexity.legislation?.length || 0,
                jurisprudence: typedPerplexity.jurisprudence?.length || 0,
                developments: typedPerplexity.developments?.length || 0,
              })
            } else {
              console.log('Perplexity Results:', { success: false })
            }

            const typedYouCom =
              youComResult as StructuredPerplexityResults | null
            if (typedYouCom && typedYouCom.success) {
              console.log('You.com General Web Results:', {
                success: true,
                webResults: typedYouCom.developments?.length || 0,
              })
            } else {
              console.log('You.com Results:', { success: false })
            }
            console.log('=== END SEARCH RESULTS SUMMARY ===')

            const combinedInternetResult = combineInternetResults(
              deepSeekResult,
              perplexityResult,
              youComResult
            )

            const discoveredGaps = detectPerplexityGaps(
              combinedInternetResult,
              combinedQueryIntent.enhancedLaws,
              combinedQueryIntent.keywords
            )

            if (discoveredGaps.hasNewContent) {
              console.log(
                '🔍 PHASE 4A: Discovered new content from Internet APIs:',
                {
                  newLaws: discoveredGaps.newLaws,
                  newKeywords: discoveredGaps.newKeywords,
                  totalNewItems:
                    discoveredGaps.newLaws.length +
                    discoveredGaps.newKeywords.length,
                  sources: {
                    fromDeepSeek: !!deepSeekResult,
                    fromPerplexity: !!perplexityResult,
                  },
                }
              )
            } else {
              console.log(
                '✅ PHASE 4A: No significant gaps detected, proceeding with current results'
              )
            }

            let secondSearchResults = null

            // Pipeline config controls second-pass behavior:
            // - forceSecondPassOnGaps: always do 2nd search if gaps found (temporal/multi_hop)
            // - enableSecondPassSearch: allow 2nd search at all
            const shouldDoSecondPass =
              pipelineConfig.enableSecondPassSearch &&
              ((discoveredGaps.hasNewContent &&
                discoveredGaps.confidenceScore > 0.4) ||
                (pipelineConfig.forceSecondPassOnGaps &&
                  discoveredGaps.hasNewContent))

            if (shouldDoSecondPass) {
              console.log(
                `🔄 [${pipelineConfig.pipelineLabel}] PHASE 4B: Starting second search with discovered content...`
              )

              try {
                const discoveredQuery = [
                  userQuery,
                  ...discoveredGaps.newKeywords,
                  ...discoveredGaps.newLaws,
                ].join(' ')

                console.log('Enhanced search query:', {
                  originalQuery: userQuery,
                  discoveredQuery: discoveredQuery,
                  newLaws: discoveredGaps.newLaws,
                  newKeywords: discoveredGaps.newKeywords,
                  pipeline: pipelineConfig.pipelineLabel,
                })

                if (
                  preferences.includeGreekLaws &&
                  discoveredGaps.newLaws.length > 0
                ) {
                  // Try Weaviate first, fallback to Elasticsearch
                  let secondLawSearch
                  try {
                    secondLawSearch = await retrieveLawsFromWeaviate(discoveredQuery, adjustedBudgets.maxLawChars / 2)
                    if (secondLawSearch.aiVersions.length === 0) {
                      secondLawSearch = await retrieveAndFilterData(discoveredQuery, 'greek_laws_collection', adjustedBudgets.maxLawChars / 2, 'voyage-3.5')
                    }
                  } catch {
                    secondLawSearch = await retrieveAndFilterData(discoveredQuery, 'greek_laws_collection', adjustedBudgets.maxLawChars / 2, 'voyage-3.5')
                  }

                  secondSearchResults = {
                    laws: secondLawSearch,
                    searchType: 'laws_focused',
                    discoveredContent: discoveredGaps,
                  }

                  console.log('✅ PHASE 4B: Second law search completed:', {
                    resultsCount: secondLawSearch.aiVersions.length,
                    totalChars: secondLawSearch.aiVersions.reduce(
                      (sum: number, text: string) => sum + text.length,
                      0
                    ),
                  })
                } else if (
                  preferences.includeGreekCourtDecisions &&
                  discoveredGaps.newKeywords.length > 0
                ) {
                  // Try Weaviate first, fallback to Elasticsearch
                  let secondCaseSearch
                  try {
                    secondCaseSearch = await retrieveCourtDecisionsFromWeaviate(discoveredQuery, adjustedBudgets.maxCaseChars / 2)
                    if (secondCaseSearch.aiVersions.length === 0) {
                      secondCaseSearch = await retrieveAndFilterData(discoveredQuery, 'dev_greek_court', adjustedBudgets.maxCaseChars / 2, undefined)
                    }
                  } catch {
                    secondCaseSearch = await retrieveAndFilterData(discoveredQuery, 'dev_greek_court', adjustedBudgets.maxCaseChars / 2, undefined)
                  }

                  secondSearchResults = {
                    cases: secondCaseSearch,
                    searchType: 'cases_focused',
                    discoveredContent: discoveredGaps,
                  }

                  console.log('✅ PHASE 4B: Second case search completed:', {
                    resultsCount: secondCaseSearch.aiVersions.length,
                    totalChars: secondCaseSearch.aiVersions.reduce(
                      (sum: number, text: string) => sum + text.length,
                      0
                    ),
                  })
                }
              } catch (secondSearchError) {
                console.log(
                  '❌ PHASE 4B: Second search failed, continuing with original results:',
                  secondSearchError instanceof Error
                    ? secondSearchError.message
                    : String(secondSearchError)
                )
                secondSearchResults = null
              }
            } else {
              console.log(
                `⏭️ [${pipelineConfig.pipelineLabel}] PHASE 4B: Skipping second search (pipeline: enableSecondPass=${pipelineConfig.enableSecondPassSearch}, gaps=${discoveredGaps.hasNewContent})`
              )
            }

            const combinedResults = combineAllSources(
              { law_data, pastcase_data },
              deepSeekResult,
              perplexityResult,
              youComResult
            )

            combined_ai_versions = combinedResults.aiVersions
            combined_references = combinedResults.fullReferences
            combined_reference_types = combinedResults.referenceTypes

            const yearPattern = /\b(20\d{2})\b/g
            const yearsFound = new Set<string>()
            combined_ai_versions.forEach((result, index) => {
              const matches = result.match(yearPattern)
              if (matches) {
                matches.forEach((year) => yearsFound.add(year))
                if (parseInt(matches[0]) >= 2023) {
                  console.log(
                    `📌 Recent content at position ${index}: Years ${matches.join(
                      ', '
                    )}`
                  )
                }
              }
            })
            console.log(
              `📅 All years in results: ${Array.from(yearsFound)
                .sort()
                .join(', ')}`
            )
            console.log(
              `🆕 Recent years (2023+): ${Array.from(yearsFound)
                .filter((y: string) => parseInt(y) >= 2023)
                .join(', ')}`
            )

            const gapCheck = detectMissingRecentLaws(combinedResults, userQuery)
            if (gapCheck.warning) {
              console.log('⚠️ Gap detected:', gapCheck.warning)
              combined_ai_versions.unshift(gapCheck.warning)
            }

            console.log('=== PHASE 4B FINAL DATABASE SUMMARY ===')
            console.log('Database Results After Iterative Search:', {
              totalDatabaseResults: combined_ai_versions.length,
              fromOriginalSearch:
                ((law_data as any)?.aiVersions?.length || 0) +
                ((pastcase_data as any)?.aiVersions?.length || 0),
              fromSecondSearch: secondSearchResults
                ? ((secondSearchResults as any).laws?.aiVersions?.length || 0) +
                  ((secondSearchResults as any).cases?.aiVersions?.length || 0)
                : 0,
              hasIterativeResults: !!secondSearchResults,
              iterativeSearchType:
                (secondSearchResults as any)?.searchType || 'none',
              gapDetectionWorked: discoveredGaps.hasNewContent,
              confidenceScore: discoveredGaps.confidenceScore,
            })

            if (discoveredGaps.hasNewContent) {
              console.log('📊 Discovered Content Impact:', {
                originalClaudeAnalysis: {
                  laws: combinedQueryIntent.enhancedLaws,
                  keywords: combinedQueryIntent.keywords,
                },
                perplexityDiscovered: {
                  newLaws: discoveredGaps.newLaws,
                  newKeywords: discoveredGaps.newKeywords,
                },
                searchEnhancement: secondSearchResults
                  ? 'SUCCESSFUL'
                  : 'SKIPPED/FAILED',
              })
            }
            console.log('=== END PHASE 4B DATABASE SUMMARY ===')

            console.log('Total Combined:', combined_ai_versions.length)

            const deepSeekCount = combined_ai_versions.filter((item) =>
              item.includes('[DeepSeek]')
            ).length
            const perplexityCount = combined_ai_versions.filter((item) =>
              item.includes('[Perplexity]')
            ).length
            const youComCount = combined_ai_versions.filter((item) =>
              item.includes('[You.com]')
            ).length
            console.log('DeepSeek Markers Found:', deepSeekCount)
            console.log('Perplexity Markers Found:', perplexityCount)
            console.log('You.com Markers Found:', youComCount)

            if (fileChunkIds && fileChunkIds.length > 0) {
              const result = await searchLibraryFiles(userQuery, fileChunkIds)
              const finalResult =
                locale === 'el'
                  ? `Αυτά είναι τα αποτελέσματα αναζήτησης από τα έγγραφα του χρήστη, χρησιμοποιήστε τα για να ενισχύσετε τις απαντήσεις σας. Αποτελέσματα Αναζήτησης: ${result}`
                  : `These are the user library documents search results, use them to enhance the responses. Search Results: ${result}`
              combined_ai_versions.push(finalResult)
            }

            const reservedForOutput = maxOutputTokenSize + 2000
            const maxTokensForDocs =
              MAX_CONTEXT_TOKENS - totalCurrentTokens - reservedForOutput

            console.log(
              `🔥 Token budget for documents: ${maxTokensForDocs} (Context: ${totalCurrentTokens}, Output: ${reservedForOutput})`
            )

            if (useVoyage && combined_ai_versions.length > 0) {
              try {
                let modifiedQuery = userQuery

                if (queryIntent.requiresCurrentLaw || pipelineConfig.enableTemporalReranking) {
                  const currentYear = new Date().getFullYear()
                  const recentYearStart = currentYear - 1

                  if (locale === 'el') {
                    modifiedQuery = `${userQuery} [ΚΡΙΤΗΡΙΟ: Προτίμηση εγγράφων ${currentYear}, ${recentYearStart}. Προτεραιότητα: 1) Πρόσφατες τροποποιήσεις νόμων ${recentYearStart}-${currentYear}, 2) Ισχύουσες διατάξεις, 3) Νέες δικαστικές αποφάσεις. Υποβάθμιση παλαιότερων εκτός αν είναι θεμελιώδεις νόμοι σε ισχύ]`
                  } else {
                    modifiedQuery = `${userQuery} [CRITERIA: Prefer documents ${currentYear}, ${recentYearStart}. Priority: 1) Recent law amendments ${recentYearStart}-${currentYear}, 2) Current provisions, 3) Latest court decisions. Downrank older unless foundational laws in effect]`
                  }

                  console.log(
                    '🕐 Temporal reranking activated for current law query'
                  )
                } else if (
                  userQuery.match(/\d{4}/) ||
                  userQuery.match(/πρόσφατ|τρέχ|ισχύ|current|recent|latest/i)
                ) {
                  if (locale === 'el') {
                    modifiedQuery = `${userQuery} [Λάβετε υπόψη χρονολογική σχετικότητα εγγράφων]`
                  } else {
                    modifiedQuery = `${userQuery} [Consider temporal relevance of documents]`
                  }
                  console.log('🕐 Implicit temporal need detected')
                }

                const voyageClient = new VoyageAIClient({
                  apiKey: process.env.VOYAGE_API_KEY!,
                })

                console.log(
                  '🔄 VoyageAI reranking ENABLED - processing results...'
                )

                const dynamicTopK = Math.min(
                  adjustedBudgets.rerankTopK,
                  combined_ai_versions.length,
                  Math.floor(maxTokensForDocs / 3000)
                )

                console.log(
                  `🔄 [${pipelineConfig.pipelineLabel}] Using dynamic topK: ${dynamicTopK} (budget allows ~${Math.floor(
                    maxTokensForDocs / 3000
                  )} docs, pipeline rerankK: ${adjustedBudgets.rerankTopK})`
                )

                const voyage_results: VoyageAI.RerankResponse =
                  await voyageClient.rerank({
                    model: 'rerank-2.5-lite',
                    query: modifiedQuery,
                    documents: combined_ai_versions,
                    topK: dynamicTopK,
                  })

                let ranked_results = voyage_results.data
                  ?.map((result) => {
                    if (
                      typeof result.index === 'number' &&
                      combined_ai_versions[result.index]
                    ) {
                      return combined_ai_versions[result.index]
                    }
                    return undefined
                  })
                  .filter((item): item is string => item !== undefined)

                if (ranked_results) {
                  ranked_results = smartContextTrimming(
                    ranked_results,
                    Math.floor(maxTokensForDocs / 3.5),
                    false
                  )

                  const ranked_reference_types = ranked_results.map(
                    (aiVersion) => {
                      const index = combined_ai_versions.indexOf(aiVersion)
                      return index !== -1
                        ? combined_reference_types[index]
                        : 'unknown'
                    }
                  )

                  ranked_results = processResultsWithSelectiveUrls(
                    ranked_results,
                    ranked_reference_types
                  )
                  console.log(
                    '🔄 Selective URL processing: removed database law URLs only'
                  )

                  console.log(
                    `✅ VoyageAI reranking successful: ${ranked_results.length} final results`
                  )

                  const composition = {
                    database: ranked_results.filter(
                      (r) =>
                        !r.includes('[DeepSeek]') &&
                        !r.includes('[Perplexity]') &&
                        !r.includes('[You.com]')
                    ).length,
                    deepseek_total: ranked_results.filter((r) =>
                      r.includes('[DeepSeek]')
                    ).length,
                    perplexity_total: ranked_results.filter((r) =>
                      r.includes('[Perplexity]')
                    ).length,
                    youcom_total: ranked_results.filter((r) =>
                      r.includes('[You.com]')
                    ).length,
                  }
                  console.log(
                    'Final Composition after VoyageAI reranking:',
                    composition
                  )

                  const ranked_references = ranked_results
                    .map((aiVersion) => {
                      const index = combined_ai_versions.indexOf(aiVersion)
                      return index !== -1
                        ? {
                            reference: combined_references[index],
                            type: combined_reference_types[index],
                          }
                        : null
                    })
                    .filter(
                      (ref): ref is { reference: string; type: string } =>
                        ref !== null
                    )

                  await storePendingReferences(
                    chatId,
                    ranked_references.map((r) => r.reference),
                    ranked_references.map((r) => r.type)
                  )

                  if (ranked_results.length === 0) {
                    return locale === 'el'
                      ? [
                          'Δεν μπόρεσα να βρω συγκεκριμένες πληροφορίες στη νομική βάση δεδομένων σχετικά με το ερώτημά σας. Παρακαλώ αναδιατυπώστε την ερώτησή σας ή παρέχετε περισσότερες λεπτομέρειες.',
                        ]
                      : [
                          "I couldn't find specific information in the legal database relevant to your query. Please rephrase your question or provide more details.",
                        ]
                  }

                  console.log(
                    '🚨 === FINAL DATA BEING SENT TO CLAUDE (WITH VOYAGEAI RERANKING) === 🚨'
                  )
                  console.log(
                    'Total documents being sent:',
                    ranked_results.length
                  )

                  const finalTokenEstimate = estimateTokens(
                    JSON.stringify(ranked_results)
                  )
                  console.log(
                    `🔥 Final token estimate: ${finalTokenEstimate} tokens`
                  )

                  ranked_results.forEach((result, index) => {
                    const source = result.includes('[You.com]')
                      ? '🌐 You.com'
                      : result.includes('[Perplexity]')
                      ? '🔍 Perplexity'
                      : result.includes('[DeepSeek]')
                      ? '🤖 DeepSeek'
                      : '📚 Database'

                    const yearMatches = result.match(/\b(19|20)\d{2}\b/g) || []
                    const lawMatches =
                      result.match(/[Νν]\.\s*\d+\/\d{4}|5037\/2023/gi) || []

                    console.log(`[${index + 1}] ${source}`)
                    if (yearMatches.length > 0)
                      console.log(`   📅 Years: ${yearMatches.join(', ')}`)
                    if (lawMatches.length > 0)
                      console.log(`   📜 Laws: ${lawMatches.join(', ')}`)
                    console.log(
                      `   📝 Content preview: ${result
                        .substring(0, 150)
                        .replace(/\n/g, ' ')}...`
                    )
                    console.log('   ---')
                  })

                  const sourceCount = {
                    database: ranked_results.filter(
                      (r) =>
                        !r.includes('[You.com]') &&
                        !r.includes('[Perplexity]') &&
                        !r.includes('[DeepSeek]')
                    ).length,
                    youcom: ranked_results.filter((r) =>
                      r.includes('[You.com]')
                    ).length,
                    perplexity: ranked_results.filter((r) =>
                      r.includes('[Perplexity]')
                    ).length,
                    deepseek: ranked_results.filter((r) =>
                      r.includes('[DeepSeek]')
                    ).length,
                  }

                  console.log('\n📊 Source distribution:')
                  console.log(`   Database: ${sourceCount.database}`)
                  console.log(`   You.com: ${sourceCount.youcom}`)
                  console.log(`   Perplexity: ${sourceCount.perplexity}`)
                  console.log(`   DeepSeek: ${sourceCount.deepseek}`)

                  console.log('🚨 === END FINAL DATA TO CLAUDE === 🚨\n')

                  return ranked_results
                }
              } catch (e) {
                console.error('❌ Voyage rerank-2.5-lite error:', e)

                const fallbackLimit = Math.floor(maxTokensForDocs / 4000)
                const trimmedFallback = smartContextTrimming(
                  combined_ai_versions.slice(0, fallbackLimit * 2),
                  Math.floor(maxTokensForDocs / 3.5),
                  false
                )

                await storePendingReferences(
                  chatId,
                  combined_references.slice(0, trimmedFallback.length),
                  combined_reference_types.slice(0, trimmedFallback.length)
                )

                const processedResults = processResultsWithSelectiveUrls(
                  trimmedFallback,
                  combined_reference_types.slice(0, trimmedFallback.length)
                )

                console.log(
                  '🔄 Selective URL processing applied to fallback results'
                )
                return processedResults
              }
            } else {
              console.log(
                '🚫 VoyageAI reranking DISABLED - using raw results with token management'
              )

              const maxDocsWithoutReranking = Math.floor(
                maxTokensForDocs / 4000
              )
              const trimmedDocuments = smartContextTrimming(
                combined_ai_versions.slice(0, maxDocsWithoutReranking * 2),
                Math.floor(maxTokensForDocs / 3.5),
                false
              )

              await storePendingReferences(
                chatId,
                combined_references.slice(0, trimmedDocuments.length),
                combined_reference_types.slice(0, trimmedDocuments.length)
              )

              if (trimmedDocuments.length === 0) {
                return locale === 'el'
                  ? [
                      'Δεν μπόρεσα να βρω συγκεκριμένες πληροφορίες στη νομική βάση δεδομένων σχετικά με το ερώτημά σας. Παρακαλώ αναδιατυπώστε την ερώτησή σας ή παρέχετε περισσότερες λεπτομέρειες.',
                    ]
                  : [
                      "I couldn't find specific information in the legal database relevant to your query. Please rephrase your question or provide more details.",
                    ]
              }

              const processedResults = processResultsWithSelectiveUrls(
                trimmedDocuments,
                combined_reference_types.slice(0, trimmedDocuments.length)
              )

              console.log(
                '🔄 Selective URL processing applied to non-reranked results'
              )

              console.log(
                '🚨 === FINAL DATA BEING SENT TO CLAUDE (NO RERANKING) === 🚨'
              )
              console.log(
                'Total documents being sent:',
                processedResults.length
              )

              const finalTokenEstimate = estimateTokens(
                JSON.stringify(processedResults)
              )
              console.log(
                `🔥 Final token estimate: ${finalTokenEstimate} tokens`
              )

              processedResults.forEach((result, index) => {
                const source = result.includes('[You.com]')
                  ? '🌐 You.com'
                  : result.includes('[Perplexity]')
                  ? '🔍 Perplexity'
                  : result.includes('[DeepSeek]')
                  ? '🤖 DeepSeek'
                  : '📚 Database'

                const yearMatches = result.match(/\b(19|20)\d{2}\b/g) || []
                const lawMatches =
                  result.match(/[Νν]\.\s*\d+\/\d{4}|5037\/2023/gi) || []

                console.log(`[${index + 1}] ${source}`)
                if (yearMatches.length > 0)
                  console.log(`   📅 Years: ${yearMatches.join(', ')}`)
                if (lawMatches.length > 0)
                  console.log(`   📜 Laws: ${lawMatches.join(', ')}`)
                console.log(
                  `   📝 Content preview: ${result
                    .substring(0, 150)
                    .replace(/\n/g, ' ')}...`
                )
                console.log('   ---')
              })

              const sourceCount = {
                database: processedResults.filter(
                  (r) =>
                    !r.includes('[You.com]') &&
                    !r.includes('[Perplexity]') &&
                    !r.includes('[DeepSeek]')
                ).length,
                youcom: processedResults.filter((r) => r.includes('[You.com]'))
                  .length,
                perplexity: processedResults.filter((r) =>
                  r.includes('[Perplexity]')
                ).length,
                deepseek: processedResults.filter((r) =>
                  r.includes('[DeepSeek]')
                ).length,
              }

              console.log('\n📊 Source distribution (No reranking):')
              console.log(`   Database: ${sourceCount.database}`)
              console.log(`   You.com: ${sourceCount.youcom}`)
              console.log(`   Perplexity: ${sourceCount.perplexity}`)
              console.log(`   DeepSeek: ${sourceCount.deepseek}`)

              console.log('🚨 === END FINAL DATA TO CLAUDE === 🚨\n')

              return processedResults
            }
          },
        }),
      },
      messages: convertToCoreMessages(
        cachedVaultFiles.length > 0
          ? [...cachedVaultFiles, ...systemMessages]
          : systemMessages
      ),
      onFinish: async (event) => {
        const messageContent = event.text || ''
        if (userEmail && subscriptionId && messageContent.trim() !== '') {
          await recordMessageUsage(subscriptionId)
        }
        revalidatePath('/dashboard', 'layout')
        if (chatId && messageContent.trim() !== '') {
          await addMessage(chatId, 'user', userQuery)
          await addMessage(chatId, 'assistant', messageContent)

          try {
            const allMessages = await getMessagesOfAchat(chatId)

            if (allMessages.length >= 4 && allMessages.length % 2 === 0) {
              console.log(
                '🔥 Creating legal summary using specialized function'
              )

              const legalSummary = await createLegalSummaryWithHaiku(
                userQuery,
                messageContent,
                locale as 'en' | 'el'
              )

              console.log(
                '✅ Legal summary created:',
                legalSummary.substring(0, 100) + '...'
              )

              await db.insert(chat_summaries).values({
                chatId,
                summary: legalSummary,
                keyTopics: [],
                legalContext: legalSummary,
                messageRangeStart: allMessages.length - 2,
                messageRangeEnd: allMessages.length - 1,
              })

              console.log('📚 Legal summary stored in database')
            }

            await manageChatContext(chatId, allMessages, locale)
            console.log(
              `🔥 Chat context managed for ${allMessages.length} total messages`
            )
          } catch (contextError) {
            console.error('❌ Failed to manage chat context:', contextError)
          }
        }
      },
    })
  }

  return result.toDataStreamResponse()
  } catch (error) {
    console.error('❌ Unhandled error in chat POST:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
