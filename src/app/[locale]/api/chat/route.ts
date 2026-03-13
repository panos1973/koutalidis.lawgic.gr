import { chatRateLimit, checkRateLimitOrRespond } from '@/lib/rateLimitResponse'
import { AISDKExporter } from 'langsmith/vercel'
import { VoyageAIClient, VoyageAI } from 'voyageai'
import { processResultsWithSelectiveUrls } from '@/lib/utils'
import { streamText, convertToCoreMessages } from 'ai'
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
import { analyzeQuery, type QueryAnalysisResult } from '@/lib/queryAnalyzer'
import { calculateSourceRichness } from '@/lib/sourceRichness'
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

    // Helper: retrieve court decisions from Weaviate only (no Elasticsearch fallback)
    const retrieveCourtDecisions = async (maxChars: number) => {
      try {
        console.log('📚 Attempting Weaviate court retrieval...')
        const weaviateResults = await retrieveCourtDecisionsFromWeaviate(userQuery, maxChars)
        console.log(`✅ Weaviate court retrieval: ${weaviateResults.aiVersions.length} results`)
        return weaviateResults
      } catch (error) {
        console.warn('⚠️ Weaviate court retrieval failed:', error)
        return { aiVersions: [], fullReferences: [], referenceTypes: [] }
      }
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

      try {
        await storePendingReferences(
          chatId,
          combined_references.slice(0, finalSearchResults.length),
          combined_reference_types.slice(0, finalSearchResults.length)
        )
      } catch (refError) {
        console.error('❌ Failed to store pending references (local LLM path):', refError)
      }
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
    console.log('🧠 Using CLAUDE — PRE-SEARCH then synthesis (no tools)')

    const selectedModel = await getLLMModel('claude-sonnet-4-6')
    const telemetrySettings = AISDKExporter.getSettings({
      metadata: { userEmail, userQuery },
      runName: 'athena_api_v1',
    })

    // === PRE-SEARCH: Run all searches BEFORE calling Claude ===
    // Full lawgic_corp pipeline: Query Analysis → Search → Court-Law Enrichment → Dedup → Rerank → Richness

    let combined_ai_versions: string[] = []
    let combined_references: string[] = []
    let combined_reference_types: string[] = []

    // STEP 1: Query Analysis (Gemini → Claude fallback)
    const currentDate = new Date().toISOString().split('T')[0]
    const queryAnalysis = await analyzeQuery(userQuery, currentDate)

    // If query needs clarification, return early
    if (queryAnalysis.quality === 'needs_clarification' && queryAnalysis.clarification) {
      console.log('❓ Query needs clarification:', queryAnalysis.clarification.reason)
      // Don't search — let Claude ask for clarification
    }

    // Use adapted queries for each search source
    const vectorDbQuery = queryAnalysis.enhanced?.adaptedQueries?.vectorDb || userQuery
    const perplexityQuery = queryAnalysis.enhanced?.adaptedQueries?.perplexity || userQuery
    const youcomQuery = queryAnalysis.enhanced?.adaptedQueries?.youcom || userQuery
    const legalField = queryAnalysis.enhanced?.legalField

    console.log(
      `🚀 [${pipelineConfig.pipelineLabel}] Starting searches - WV_LAW:${
        preferences.includeGreekLaws
      } WV_COURT:${preferences.includeGreekCourtDecisions} PX:${!!PERPLEXITY_API_KEY} DS:${USE_DEEPSEEK} YC:${USE_YOUCOM}`
    )
    const parallelStartTime = Date.now()

    let law_data: any = null
    let pastcase_data: any = null
    let deepSeekResult: StructuredPerplexityResults | null = null
    let perplexityResult: StructuredPerplexityResults | null = null
    let youComResult: StructuredPerplexityResults | null = null

    const allSearchPromises: Promise<void>[] = []

    // Helper: retrieve laws from Weaviate with Elasticsearch fallback
    const retrieveLaws = async (query: string, maxChars: number) => {
      try {
        console.log('📚 [LAWS-WV] Starting Weaviate law retrieval...')
        const weaviateResults = await retrieveLawsFromWeaviate(query, maxChars)
        if (weaviateResults.aiVersions.length > 0) {
          console.log(`✅ [LAWS-WV] Retrieved ${weaviateResults.aiVersions.length} documents`)
          return weaviateResults
        }
        console.log('⚠️ Weaviate law search returned no results, falling back to Elasticsearch')
      } catch (error) {
        console.warn('⚠️ Weaviate law retrieval failed, falling back to Elasticsearch:', error)
      }
      return retrieveAndFilterData(query, 'greek_laws_collection', maxChars, 'voyage-3.5')
    }

    // Helper: retrieve court decisions from Weaviate only (no Elasticsearch fallback)
    const retrieveCourtDecisions = async (query: string, maxChars: number) => {
      try {
        console.log(`📚 [WV-COURT] Starting Weaviate court retrieval...${legalField ? ` (domain: ${legalField})` : ''}`)
        const weaviateResults = await retrieveCourtDecisionsFromWeaviate(query, maxChars)
        console.log(`✅ [WV-COURT] Completed: ${weaviateResults.aiVersions.length} results`)
        return weaviateResults
      } catch (error) {
        console.warn('⚠️ Weaviate court retrieval failed:', error)
        return { aiVersions: [], fullReferences: [], referenceTypes: [] }
      }
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
              retrieveLaws(vectorDbQuery, balancedMaxLawChars),
              retrieveCourtDecisions(vectorDbQuery, balancedMaxCaseChars),
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
            law_data = await retrieveLaws(vectorDbQuery, adjustedBudgets.maxLawChars)
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
            pastcase_data = await retrieveCourtDecisions(vectorDbQuery, adjustedBudgets.maxCaseChars)
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
              searchDeepSeekForLegal(vectorDbQuery),
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
              searchInternetForLegal(perplexityQuery),
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
              searchYouComForLegal(youcomQuery),
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

    // ========== DEDUPLICATION PIPELINE (lawgic_corp architecture) ==========
    // Step 1: Prepare database results arrays
    const databaseResultsForDedup: any[] = []
    if (law_data?.aiVersions && Array.isArray(law_data.aiVersions)) {
      law_data.aiVersions.forEach((content: string, index: number) => {
        databaseResultsForDedup.push({
          content,
          fullReference: law_data.fullReferences?.[index] || '#',
          referenceType: law_data.referenceTypes?.[index] || 'database_law',
        })
      })
    }
    if (pastcase_data?.aiVersions && Array.isArray(pastcase_data.aiVersions)) {
      pastcase_data.aiVersions.forEach((content: string, index: number) => {
        databaseResultsForDedup.push({
          content,
          fullReference: pastcase_data.fullReferences?.[index] || '#',
          referenceType: pastcase_data.referenceTypes?.[index] || 'database_case',
        })
      })
    }

    // Step 2: Prepare AI search results arrays
    const prepareAIResults = (result: StructuredPerplexityResults | null, label: string) => {
      const results: any[] = []
      if (!result || !result.success) return results
      const categories = ['legislation', 'jurisprudence', 'developments'] as const
      categories.forEach((cat) => {
        const items = result[cat]
        if (items && Array.isArray(items)) {
          items.forEach((item) => {
            if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
              results.push({
                content: `**[${label}] ${item.title}**\n\n${item.preview_text}\n\n[Πηγή: ${item.source_domain}](${item.url})\nΕμπιστοσύνη: ${item.confidence}`,
                fullReference: item.url || '#',
                referenceType: `${label.toLowerCase()}_${cat === 'jurisprudence' ? 'jurisprudence' : cat === 'legislation' ? 'legislation' : 'development'}`,
                confidence: item.confidence,
              })
            }
          })
        }
      })
      return results
    }

    const deepSeekResultsForDedup = prepareAIResults(deepSeekResult, 'DeepSeek')
    const perplexityResultsForDedup = prepareAIResults(perplexityResult, 'Perplexity')
    const youComResultsForDedup = prepareAIResults(youComResult, 'You.com')

    console.log(`📊 Pre-dedup counts: DB=${databaseResultsForDedup.length}, DS=${deepSeekResultsForDedup.length}, PX=${perplexityResultsForDedup.length}, YC=${youComResultsForDedup.length}`)

    // Step 3: Run deduplication with similarity scoring & corroboration
    const processedResults = deduplicateAllSources(
      databaseResultsForDedup,
      perplexityResultsForDedup,
      deepSeekResultsForDedup,
      youComResultsForDedup
    )

    console.log(`✅ Dedup complete: ${processedResults.length} unique results from ${databaseResultsForDedup.length + deepSeekResultsForDedup.length + perplexityResultsForDedup.length + youComResultsForDedup.length} total`)

    // Step 4: Convert to expected format
    const dedupFormatted = convertToExpectedFormat(processedResults)
    combined_ai_versions = dedupFormatted.aiVersions
    combined_references = dedupFormatted.fullReferences
    combined_reference_types = dedupFormatted.referenceTypes

    // Inject graph context (amendment chains, version history) into results
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

    // Step 5: Source richness scoring - dynamic maxTokens based on source quality
    const richnessScore = calculateSourceRichness(processedResults, 0) // voyageHighScoreCount updated after reranking
    console.log(`📊 Source Richness: tier=${richnessScore.tier}, maxTokens=${richnessScore.maxTokens}`)

    const reservedForOutput = Math.max(maxOutputTokenSize, richnessScore.maxTokens) + 2000
    const maxTokensForDocs =
      MAX_CONTEXT_TOKENS - totalCurrentTokens - reservedForOutput

    console.log(
      `🔥 Token budget for documents: ${maxTokensForDocs} (Context: ${totalCurrentTokens}, Output: ${reservedForOutput})`
    )

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

        // Count high-scoring results for richness recalculation
        const voyageHighScoreCount = voyage_results.data?.filter(
          (r) => typeof r.relevanceScore === 'number' && r.relevanceScore > 0.7
        ).length || 0

        if (ranked_results) {
          // Guarantee court decisions are included in results
          const courtDecisionIndices = combined_reference_types
            .map((type, idx) => ({ type, idx }))
            .filter((item) => item.type.includes('database_case') || item.type.includes('database_court') || item.type.includes('jurisprudence'))
            .map((item) => item.idx)

          const missingCourtDecisions = courtDecisionIndices
            .filter((idx) => !ranked_results!.includes(combined_ai_versions[idx]))
            .map((idx) => combined_ai_versions[idx])
            .filter(Boolean)

          if (missingCourtDecisions.length > 0) {
            console.log(`Guaranteeing ${missingCourtDecisions.length} court decisions in results`)
            ranked_results = [...ranked_results, ...missingCourtDecisions]
          }

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

      try {
        await storePendingReferences(
          chatId,
          combined_references.slice(0, finalSearchResults.length),
          combined_reference_types.slice(0, finalSearchResults.length)
        )
      } catch (refError) {
        console.error('❌ Failed to store pending references (Claude path):', refError)
      }
    }

    console.log(
      `🧠 Claude receiving ${finalSearchResults.length} search results`
    )

    // Inject search results into messages for Claude (pre-search architecture)
    const qualityHint = locale === 'el' ? richnessScore.qualityHintEl : richnessScore.qualityHint
    const contextMessage =
      finalSearchResults.length > 0
        ? `\n\n[Source Quality: ${richnessScore.tier} | ${qualityHint}]\n\nRelevant legal documents and information:\n\n${finalSearchResults.join(
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

    result = await streamText({
      model: selectedModel,
      system: pipelineEnhancedSystemMessage,
      messages: enrichedMessages,
      maxTokens: richnessScore.maxTokens,
      experimental_telemetry: telemetrySettings,
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


  console.log('✅ Returning streamText response to client')
  return result.toDataStreamResponse()
  } catch (error) {
    console.error('❌ Unhandled error in chat POST:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')
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
