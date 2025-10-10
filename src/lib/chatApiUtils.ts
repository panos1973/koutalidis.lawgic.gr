import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { createPostgressVectorStore } from '@/app/[locale]/actions/chat_actions'
import Anthropic from '@anthropic-ai/sdk'

// Debug mode control - set via environment variable
const DEBUG_MODE =
  process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development'
const VERBOSE_DEBUG = process.env.VERBOSE_DEBUG === 'true'

// Helper function for conditional logging
function debugLog(message: string, data?: any) {
  if (DEBUG_MODE) {
    if (data !== undefined) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}

function verboseLog(message: string, data?: any) {
  if (VERBOSE_DEBUG) {
    if (data !== undefined) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}

// Types and interfaces
interface FileDetail {
  filename: string
  content_preview: string
  full_content: string
}

interface ProcessedFileData {
  chatFiles: string[]
  chatFileDetails: FileDetail[]
}

interface FilteredData {
  aiVersions: string[]
  fullReferences: string[]
  referenceTypes: string[]
  contraVersions?: string[]
  contraReferences?: string[]
}

interface UserPreferences {
  includeGreekLaws: boolean
  includeGreekCourtDecisions: boolean
  includeEuropeanLaws: boolean
  includeEuropeanCourtDecisions: boolean
}

interface CollectionStrings {
  availableCollections: string
  searchInstructions: string
}

interface EnhancedRetrievalOptions {
  enable_recency_boost?: boolean
  enable_smart_law_detection?: boolean
  enable_dual_search?: boolean
  experiment_mode?: 'original' | 'enhanced' | 'dual'
  query_intent?: {
    requiresCurrentLaw?: boolean
    lawTypes?: string[]
    timeframe?: string
    needsEUCheck?: boolean
    isPermissibilityCheck?: boolean
  }
  debug_mode?: boolean
  enable_law_aware_case_filtering?: boolean
  temporal_law_filtering?: boolean
  cross_reference_validation?: boolean
  min_relevance_year?: number
  enableDateBoost?: boolean
  enableTemporalFilter?: boolean
  enableLawAwareFilter?: boolean
  enableDiversification?: boolean
  detectedLaws?: string[]
  requiresCurrentLaw?: boolean
}

type LocaleType = 'en' | 'el'

/**
 * Extracts year from date strings commonly found in legal documents
 */
function extractYear(dateStr: string): number | null {
  if (!dateStr) return null

  const directYear = dateStr.match(/\b(19|20)\d{2}\b/)
  if (directYear) {
    return parseInt(directYear[0])
  }

  const DateMatch = dateStr.match(/\b(19|20)\d{2}\b/)
  if (DateMatch) {
    return parseInt(DateMatch[0])
  }

  return null
}

/**
 * Extracts law year from law reference strings
 */
function extractLawYear(lawRef: string): number | null {
  if (!lawRef) return null

  const yearMatch = lawRef.match(/\/(\d{4})/)
  return yearMatch ? parseInt(yearMatch[1]) : null
}

/**
 * Extracts law number from various law reference formats
 */
function extractLawNumber(lawRef: string): string | null {
  if (!lawRef) return null

  const numberMatch = lawRef.match(/(\d+\/\d{4})/)
  return numberMatch ? numberMatch[1] : null
}

/**
 * Normalizes law reference to metadata format
 */
function normalizeLawReference(lawRef: string): string {
  const lawNumber = extractLawNumber(lawRef)
  if (!lawNumber) return lawRef

  return `ν. ${lawNumber}`
}

/**
 * Checks if a case is temporally compatible with detected laws
 */
function isTemporallyCompatible(
  lawYears: number[],
  decisionDate: string
): boolean {
  if (!lawYears.length || !decisionDate) return true

  const decisionYear = extractYear(decisionDate)
  if (!decisionYear) return true

  const minLawYear = Math.min(...lawYears)
  const minAcceptableYear = minLawYear - 4
  const maxAcceptableYear = 2025

  return decisionYear >= minAcceptableYear && decisionYear <= maxAcceptableYear
}

/**
 * Checks if case metadata contains references to target laws
 */
function hasLawReferenceInMetadata(
  caseMainLaws: string,
  targetLaws: string[]
): boolean {
  if (!caseMainLaws || !targetLaws.length) return false

  const normalizedMainLaws = caseMainLaws.toLowerCase()

  return targetLaws.some((law) => {
    const lawNumber = law.match(/(\d+\/\d+)/)?.[1]
    if (!lawNumber) return false

    const searchPatterns = [
      `ν. ${lawNumber}`,
      `ν.${lawNumber}`,
      `νόμος ${lawNumber}`,
      lawNumber,
    ]

    return searchPatterns.some((pattern) =>
      normalizedMainLaws.includes(pattern.toLowerCase())
    )
  })
}

/**
 * Finds related laws through cross-references in law documents
 */
function findRelatedLawNetwork(
  targetLaws: string[],
  lawDocuments: any[]
): string[] {
  const relatedLaws = new Set(targetLaws)

  for (const targetLaw of targetLaws) {
    const normalizedTarget = normalizeLawReference(targetLaw)
    const targetNumber = extractLawNumber(targetLaw)

    if (!targetNumber) continue

    lawDocuments.forEach((doc) => {
      try {
        const metadata = doc.metadata || {}
        const mainLaws = Array.isArray(metadata.main_laws)
          ? metadata.main_laws
          : metadata.main_laws
          ? [metadata.main_laws]
          : []
        const keyArticles = Array.isArray(metadata.key_articles)
          ? metadata.key_articles
          : metadata.key_articles
          ? [metadata.key_articles]
          : []

        const referencesTarget =
          mainLaws.some(
            (law: string) =>
              law.includes(targetNumber) || law === normalizedTarget
          ) ||
          keyArticles.some((article: string) => article.includes(targetNumber))

        if (referencesTarget) {
          const docLawNumber = extractLawNumber(metadata.decision_number || '')
          if (docLawNumber) {
            relatedLaws.add(`ν. ${docLawNumber}`)
            relatedLaws.add(`Ν.${docLawNumber}`)
          }
        }

        if (metadata.decision_number) {
          const docNumber = extractLawNumber(metadata.decision_number)
          if (
            docNumber &&
            keyArticles.some((article: string) => article.includes(docNumber))
          ) {
            relatedLaws.add(`ν. ${docNumber}`)
            relatedLaws.add(`Ν.${docNumber}`)
          }
        }
      } catch (error) {
        verboseLog('Error processing law network for doc:', error)
      }
    })
  }

  return Array.from(relatedLaws)
}

/**
 * Calculates enhanced law relevance score including network relationships
 */
function calculateEnhancedLawRelevanceScore(
  caseMetadata: any,
  lawNetwork: string[],
  primaryLaws: string[]
): number {
  if (!caseMetadata || !lawNetwork.length) return 0

  let score = 0
  const mainLaws = caseMetadata.main_laws || ''
  const decisionDate = caseMetadata.decision_date || ''
  const decisionYear = extractYear(decisionDate)

  for (const law of lawNetwork) {
    if (hasLawReferenceInMetadata(mainLaws, [law])) {
      score += 5

      if (
        primaryLaws.some(
          (primaryLaw) => extractLawNumber(primaryLaw) === extractLawNumber(law)
        )
      ) {
        score += 10
      }

      const lawYear = extractLawYear(law)
      if (lawYear && decisionYear) {
        const yearDiff = Math.abs(decisionYear - lawYear)
        if (yearDiff <= 1) score += 8
        else if (yearDiff <= 3) score += 5
        else if (yearDiff <= 6) score += 2
        else if (yearDiff <= 10) score += 1
      }
    }
  }

  return score
}

/**
 * Calculates basic law relevance score for case prioritization (fallback)
 */
function calculateBasicLawRelevanceScore(
  caseMetadata: any,
  targetLaws: string[]
): number {
  if (!caseMetadata || !targetLaws.length) return 0

  let score = 0
  const mainLaws = caseMetadata.main_laws || ''
  const decisionDate = caseMetadata.decision_date || ''

  for (const law of targetLaws) {
    if (hasLawReferenceInMetadata(mainLaws, [law])) {
      score += 10

      const lawYear = extractLawYear(law)
      const decisionYear = extractYear(decisionDate)

      if (lawYear && decisionYear) {
        const yearDiff = Math.abs(decisionYear - lawYear)
        if (yearDiff <= 2) score += 5
        else if (yearDiff <= 5) score += 2
        else if (yearDiff <= 10) score += 1
      }
    }
  }

  return score
}

/**
 * Advanced law-aware case filtering with network intelligence
 */
function applyAdvancedLawAwareCaseFiltering(
  cases: any[],
  targetLaws: string[],
  lawDocuments: any[],
  options: EnhancedRetrievalOptions
): any[] {
  if (!options.enable_law_aware_case_filtering || !targetLaws.length) {
    return cases
  }

  const lawNetwork = findRelatedLawNetwork(targetLaws, lawDocuments)

  debugLog(
    `🕸️ Law network built: ${lawNetwork.length} related laws for ${targetLaws.length} target laws`
  )

  const lawYears = lawNetwork.map(extractLawYear).filter(Boolean) as number[]

  const relevantCases = cases.filter((caseDoc) => {
    try {
      const metadata = caseDoc.metadata || {}

      if (options.temporal_law_filtering && lawYears.length > 0) {
        if (!isTemporallyCompatible(lawYears, metadata.decision_date)) {
          return false
        }
      }

      if (options.cross_reference_validation) {
        if (!hasLawReferenceInMetadata(metadata.main_laws, lawNetwork)) {
          return false
        }
      }

      return true
    } catch (error) {
      verboseLog('Error in advanced law-aware filtering:', error)
      return true
    }
  })

  const scoredCases = relevantCases.map((caseDoc) => ({
    ...caseDoc,
    _relevanceScore: calculateEnhancedLawRelevanceScore(
      caseDoc.metadata,
      lawNetwork,
      targetLaws
    ),
  }))

  const sortedCases = scoredCases
    .sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0))
    .map(({ _relevanceScore, ...caseDoc }) => caseDoc)

  debugLog(
    `🎯 Advanced filtering: ${cases.length} → ${relevantCases.length} cases`
  )

  return sortedCases
}

/**
 * Filters and sorts cases based on basic law awareness (fallback)
 */
function applyLawAwareCaseFiltering(
  cases: any[],
  targetLaws: string[],
  options: EnhancedRetrievalOptions
): any[] {
  if (!options.enable_law_aware_case_filtering || !targetLaws.length) {
    return cases
  }

  const lawYears = targetLaws.map(extractLawYear).filter(Boolean) as number[]

  const relevantCases = cases.filter((caseDoc) => {
    try {
      const metadata = caseDoc.metadata || {}

      if (options.temporal_law_filtering && lawYears.length > 0) {
        if (!isTemporallyCompatible(lawYears, metadata.decision_date)) {
          return false
        }
      }

      if (options.cross_reference_validation) {
        if (!hasLawReferenceInMetadata(metadata.main_laws, targetLaws)) {
          return false
        }
      }

      return true
    } catch (error) {
      verboseLog('Error in basic law-aware filtering:', error)
      return true
    }
  })

  const sortedCases = relevantCases.sort((a, b) => {
    const scoreA = calculateBasicLawRelevanceScore(a.metadata, targetLaws)
    const scoreB = calculateBasicLawRelevanceScore(b.metadata, targetLaws)
    return scoreB - scoreA
  })

  debugLog(
    `🎯 Basic filtering: ${cases.length} → ${relevantCases.length} cases`
  )

  return sortedCases
}

/**
 * Smart query analysis to determine optimal search strategy
 */
export function analyzeQueryForSearch(
  query: string
): EnhancedRetrievalOptions['query_intent'] {
  try {
    const currentTerms = [
      'current',
      'latest',
      'modern',
      'recent',
      'today',
      'now',
      'current law',
      '2024',
      '2025',
      'new',
      'updated',
      'revised',
      'amended',
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
      'ισχύων',
      'ισχύουσα',
      'νέος',
      'νέα',
      'νέο',
      'επικαιροποιημένος',
      'τροποποιημένος',
    ]

    const euIndicators = [
      'directive',
      'οδηγία',
      'regulation',
      'κανονισμός',
      'EU',
      'ΕΕ',
      'european',
      'ευρωπαϊκ',
      'transpose',
      'ενσωμάτωση',
      'harmoniz',
      'εναρμόνιση',
    ]

    const needsEULaw = euIndicators.some((term) =>
      query.toLowerCase().includes(term.toLowerCase())
    )

    const permissibilityTerms = [
      'επιτρέπεται',
      'μπορώ',
      'νόμιμο',
      'allowed',
      'permitted',
      'legal',
      'can I',
      'is it legal',
    ]

    const isPermissibilityQuestion = permissibilityTerms.some((term) =>
      query.toLowerCase().includes(term.toLowerCase())
    )

    const lawPatterns = [
      /Ν\.\s*\d+\/\d+/g,
      /νόμος\s*\d+\/\d+/gi,
      /Ν\d+\/\d+/g,
      /ΠΔ\.\s*\d+\/\d+/g,
      /ΥΑ\.\s*\d+\/\d+/g,
      /ν\.\s*\d+\/\d+/g,
    ]

    const requiresCurrentLaw =
      currentTerms.some((term) =>
        query.toLowerCase().includes(term.toLowerCase())
      ) || isPermissibilityQuestion

    const detectedLaws: string[] = []
    lawPatterns.forEach((pattern) => {
      const matches = query.match(pattern)
      if (matches) {
        detectedLaws.push(...matches)
      }
    })

    return {
      requiresCurrentLaw,
      lawTypes: detectedLaws,
      timeframe:
        requiresCurrentLaw || isPermissibilityQuestion ? 'recent' : 'all',
      needsEUCheck: needsEULaw,
      isPermissibilityCheck: isPermissibilityQuestion,
    }
  } catch (error) {
    verboseLog('Error in query analysis, using safe defaults:', error)
    return {
      requiresCurrentLaw: false,
      lawTypes: [],
      timeframe: 'all',
    }
  }
}

/**
 * Trims an array of strings to fit within a specified token limit
 */
export function trimToTokenLimit(
  results: string[],
  maxTokens: number
): string[] {
  debugLog(`Trimming ${results.length} results to ${maxTokens} tokens`)

  const estimateTokens = (text: string) => Math.ceil(text.length / 3.2)

  let totalTokens = 0
  const trimmedResults: string[] = []

  for (const result of results) {
    const resultTokens = estimateTokens(result)

    if (totalTokens + resultTokens <= maxTokens) {
      trimmedResults.push(result)
      totalTokens += resultTokens
    } else {
      const remainingTokens = maxTokens - totalTokens
      if (remainingTokens > 50) {
        const remainingChars = remainingTokens * 3.2
        let partialResult = result.slice(0, remainingChars)

        const sentenceBreak = Math.max(
          partialResult.lastIndexOf('. '),
          partialResult.lastIndexOf('; '),
          partialResult.lastIndexOf(': '),
          partialResult.lastIndexOf('\n\n')
        )

        if (sentenceBreak > partialResult.length * 0.7) {
          partialResult = partialResult.substring(0, sentenceBreak + 1) + '...'
        } else {
          partialResult += '...'
        }

        trimmedResults.push(partialResult)
      }
      break
    }
  }

  return trimmedResults
}

/**
 * Enhanced retrieval function with smart search options and advanced law-aware case filtering
 */
export async function retrieveAndFilterData(
  query: string,
  index: string,
  maxCharacters: number,
  model_name?: string,
  enhancedOptions?: EnhancedRetrievalOptions,
  lawDocuments?: any[]
): Promise<FilteredData> {
  console.log(`Starting data retrieval - Index: ${index}`)

  try {
    const queryAnalysis =
      enhancedOptions?.query_intent || analyzeQueryForSearch(query)

    const safeQueryAnalysis = {
      requiresCurrentLaw: false,
      lawTypes: [],
      timeframe: 'all',
      ...queryAnalysis,
    }

    const searchOptions = {
      index,
      model_name,
      enable_recency_boost:
        enhancedOptions?.enable_recency_boost ??
        safeQueryAnalysis.requiresCurrentLaw,
      enable_smart_law_detection:
        enhancedOptions?.enable_smart_law_detection ??
        (safeQueryAnalysis.lawTypes && safeQueryAnalysis.lawTypes.length > 0),
      enable_dual_search: enhancedOptions?.enable_dual_search ?? false,
      experiment_mode: (enhancedOptions?.experiment_mode ?? 'enhanced') as
        | 'original'
        | 'enhanced'
        | 'dual',
      debug_mode: enhancedOptions?.debug_mode ?? false,
      custom_law_boost:
        safeQueryAnalysis.lawTypes && safeQueryAnalysis.lawTypes.length > 0
          ? 2.5
          : 2.0,
    }

    // Stage 1: Discovery search
    let discoveredLaws: string[] = []
    if (index === 'greek_laws_collection' || index === 'dev_greek_court') {
      try {
        debugLog('🔍 Stage 1: Discovery search for recent/relevant content...')

        const discoveryQuery =
          index === 'greek_laws_collection'
            ? `${query} τρέχων`
            : `${query} ισχύον`

        const discoveryOptions = {
          ...searchOptions,
          experiment_mode: 'enhanced' as 'original' | 'enhanced' | 'dual',
          enable_recency_boost: true,
          custom_law_boost: 3.0,
        }

        const discoveryResults = await elasticsearchRetrieverHybridSearch(
          discoveryQuery,
          discoveryOptions
        )

        // Process discovery results - REMOVED individual logging
        if (index === 'dev_greek_court') {
          discoveryResults.slice(0, 5).forEach((result) => {
            const relevantLawsMatch = result.fullReference.match(
              /<relevant_laws>([\s\S]*?)<\/relevant_laws>/
            )
            const relatedProvisionsMatch = result.fullReference.match(
              /<related_law_provisions>([\s\S]*?)<\/related_law_provisions>/
            )

            if (relevantLawsMatch && relevantLawsMatch[1]) {
              const laws = relevantLawsMatch[1]
                .split(/[,;]/)
                .map((l) => l.trim())
                .filter(Boolean)
              laws.forEach((law) => {
                if (law && !discoveredLaws.includes(law)) {
                  discoveredLaws.push(law)
                }
              })
            }

            if (relatedProvisionsMatch && relatedProvisionsMatch[1]) {
              const provisions = relatedProvisionsMatch[1]
                .split(/[,;]/)
                .map((p) => p.trim())
                .filter(Boolean)
              provisions.forEach((provision) => {
                if (provision && !discoveredLaws.includes(provision)) {
                  discoveredLaws.push(provision)
                }
              })
            }
          })
        } else {
          const lawPattern = /[Νν]\.\s*(\d+\/\d{4})/g
          discoveryResults.slice(0, 5).forEach((result) => {
            const matches = result.aiVersion.match(lawPattern)
            if (matches) {
              matches.forEach((match) => {
                const normalized = match.replace(/\s+/g, ' ').trim()
                if (!discoveredLaws.includes(normalized)) {
                  discoveredLaws.push(normalized)
                }
              })
            }
          })
        }

        if (discoveredLaws.length > 0) {
          console.log(`✅ Stage 1: Discovered ${discoveredLaws.length} laws`)

          if (enhancedOptions) {
            enhancedOptions.detectedLaws = [
              ...(enhancedOptions.detectedLaws || []),
              ...discoveredLaws,
            ]
          }
        }
      } catch (error) {
        console.warn('Stage 1 discovery failed, continuing with single-stage')
      }
    }

    // Contra search for court decisions
    let contraDiscoveries: any[] = []
    if (index === 'dev_greek_court' && discoveredLaws.length > 0) {
      try {
        debugLog('⚖️ Searching for contra decisions...')

        const contraQuery = `${query} απορρίφθηκε απέρριψε αντίθετη άποψη μειοψηφία`

        const contraOptions = {
          ...searchOptions,
          experiment_mode: 'enhanced' as 'original' | 'enhanced' | 'dual',
          enable_smart_law_detection: true,
          second_search_params: {
            different_fields: [
              'metadata.legal_positions_rejected',
              'metadata.judicial_reasoning_contra',
            ],
            different_boost: 2.0,
          },
        }

        const contraResults = await elasticsearchRetrieverHybridSearch(
          contraQuery,
          contraOptions
        )

        if (contraResults.length > 0) {
          contraDiscoveries = contraResults.slice(0, 3)
          debugLog(`✅ Found ${contraDiscoveries.length} contra decisions`)
        }
      } catch (error) {
        verboseLog('Contra search failed, continuing without:', error)
      }
    }

    // Stage 2: Main search
    debugLog('🎯 Stage 2: Main search with enhanced parameters...')

    const currentYear = new Date().getFullYear()
    searchOptions.custom_law_boost = safeQueryAnalysis.requiresCurrentLaw
      ? 3.0
      : 2.0
    if (safeQueryAnalysis.needsEUCheck) {
      searchOptions.custom_law_boost *= 1.3
    }

    // Add discovered laws to searchOptions if any were found
    const enhancedSearchOptions = {
      ...searchOptions,
      detected_laws: discoveredLaws.length > 0 ? discoveredLaws : undefined,
      custom_law_boost:
        discoveredLaws.length > 0
          ? searchOptions.custom_law_boost * 1.2
          : searchOptions.custom_law_boost,
    }

    const retrieved_data = await elasticsearchRetrieverHybridSearch(
      query,
      enhancedSearchOptions
    )

    // Apply law-aware case filtering
    let processed_data = retrieved_data
    if (
      index === 'dev_greek_court' &&
      safeQueryAnalysis.lawTypes &&
      safeQueryAnalysis.lawTypes.length > 0
    ) {
      const caseFilteringOptions: EnhancedRetrievalOptions = {
        enable_law_aware_case_filtering: true,
        temporal_law_filtering: true,
        cross_reference_validation: true,
        debug_mode: false,
      }

      if (lawDocuments && lawDocuments.length > 0) {
        processed_data = applyAdvancedLawAwareCaseFiltering(
          retrieved_data,
          safeQueryAnalysis.lawTypes,
          lawDocuments,
          caseFilteringOptions
        )
      } else {
        processed_data = applyLawAwareCaseFiltering(
          retrieved_data,
          safeQueryAnalysis.lawTypes,
          caseFilteringOptions
        )
      }
    }

    let total_characters = 0
    const filtered_data: FilteredData = {
      aiVersions: [],
      fullReferences: [],
      referenceTypes: [],
    }

    const referenceType =
      index === 'greek_laws_collection'
        ? 'greek_law'
        : index === 'collection_law_embeddings'
        ? 'greek_law'
        : index === 'collection_law_embeddings_2024'
        ? 'greek_law'
        : index === 'dev_greek_court'
        ? 'greek_case'
        : 'unknown'

    // Process results with character limit
    for (const doc of processed_data) {
      if (total_characters + doc.aiVersion.length <= maxCharacters) {
        filtered_data.aiVersions.push(doc.aiVersion)
        filtered_data.fullReferences.push(doc.fullReference)
        filtered_data.referenceTypes.push(referenceType)
        total_characters += doc.aiVersion.length
      } else {
        const remainingChars = maxCharacters - total_characters
        if (remainingChars > 200) {
          const partialContent =
            doc.aiVersion.substring(0, remainingChars - 3) + '...'
          filtered_data.aiVersions.push(partialContent)
          filtered_data.fullReferences.push(doc.fullReference)
          filtered_data.referenceTypes.push(referenceType)
        }
        break
      }
    }

    console.log(
      `✅ Retrieved ${filtered_data.aiVersions.length} documents (${total_characters} chars)`
    )

    // Add contra results if found
    if (contraDiscoveries && contraDiscoveries.length > 0) {
      filtered_data.contraVersions = contraDiscoveries.map(
        (doc) => doc.aiVersion
      )
      filtered_data.contraReferences = contraDiscoveries.map(
        (doc) => doc.fullReference
      )
    }

    return filtered_data
  } catch (error) {
    console.error('Error in retrieveAndFilterData:', error)

    // Fallback to basic retrieval
    try {
      console.log('🔄 Attempting fallback to basic retrieval...')
      const basic_retrieved_data = await elasticsearchRetrieverHybridSearch(
        query,
        {
          index,
          model_name,
          experiment_mode: 'original',
        }
      )

      let total_characters = 0
      const fallback_data: FilteredData = {
        aiVersions: [],
        fullReferences: [],
        referenceTypes: [],
      }

      const referenceType =
        index === 'greek_laws_collection' || index.includes('law')
          ? 'greek_law'
          : 'greek_case'

      for (const doc of basic_retrieved_data) {
        if (total_characters + doc.aiVersion.length <= maxCharacters) {
          fallback_data.aiVersions.push(doc.aiVersion)
          fallback_data.fullReferences.push(doc.fullReference)
          fallback_data.referenceTypes.push(referenceType)
          total_characters += doc.aiVersion.length
        } else {
          break
        }
      }

      console.log('✅ Fallback retrieval successful')
      return fallback_data
    } catch (fallbackError) {
      console.error('Fallback retrieval also failed:', fallbackError)
      return { aiVersions: [], fullReferences: [], referenceTypes: [] }
    }
  }
}

/**
 * Processes uploaded files for a specific chat
 */
export async function processUploadedFiles(
  chatId: string
): Promise<ProcessedFileData> {
  verboseLog('Processing uploaded files for chatId:', chatId)
  try {
    const vectorStore = await createPostgressVectorStore(chatId)
    const results = await vectorStore.similaritySearch('filename_fetch', 5)

    const chatFileNames = Array.from(
      new Set(
        results
          .map((result: any) => result.metadata?.fileName)
          .filter((name: any): name is string => Boolean(name))
      )
    )

    console.log(`📚 Found ${chatFileNames.length} uploaded files`)

    return {
      chatFiles: chatFileNames,
      chatFileDetails: results.map((result: any) => ({
        filename: result.metadata?.fileName ?? 'Undefined filename',
        content_preview: result.pageContent.slice(0, 100) + '...',
        full_content: result.pageContent,
      })),
    }
  } catch (error) {
    console.error('Error in processUploadedFiles:', error)
    return { chatFiles: [], chatFileDetails: [] }
  }
}

/**
 * Enhanced collection strings with proper content based on user preferences and locale
 */
export function getCollectionStrings(
  preferences: UserPreferences,
  locale: LocaleType
): CollectionStrings {
  debugLog('Generating collection strings for locale:', locale)

  const collections: Record<LocaleType, CollectionStrings> = {
    en: {
      availableCollections: '',
      searchInstructions: '',
    },
    el: {
      availableCollections: '',
      searchInstructions: '',
    },
  }

  const {
    includeGreekLaws,
    includeGreekCourtDecisions,
    includeEuropeanLaws,
    includeEuropeanCourtDecisions,
  } = preferences

  const enCollections: string[] = []
  const elCollections: string[] = []

  if (includeGreekLaws) {
    enCollections.push(
      '• Greek Laws Collection (collection_law_embeddings): Contains Greek legislation up to 2023',
      '• Greek Laws 2024 Collection (collection_law_embeddings_2024): Contains latest Greek legislation from 2024'
    )
    elCollections.push(
      '• Συλλογή Ελληνικής Νομοθεσίας (collection_law_embeddings): Περιέχει την ελληνική νομοθεσία έως το 2023',
      '• Συλλογή Νέας Ελληνικής Νομοθεσίας 2024 (collection_law_embeddings_2024): Περιέχει την πιο πρόσφατη ελληνική νομοθεσία του 2024'
    )
  }

  if (includeGreekCourtDecisions) {
    enCollections.push(
      '• Past Cases Collection (dev_greek_court): Contains historical court decisions and case law'
    )
    elCollections.push(
      '• Συλλογή Νομολογίας (dev_greek_court): Περιέχει ιστορικές δικαστικές αποφάσεις και νομολογία'
    )
  }

  if (includeEuropeanLaws) {
    enCollections.push(
      '• European Laws Collection: Contains EU regulations, directives, and legal framework'
    )
    elCollections.push(
      '• Συλλογή Ευρωπαϊκής Νομοθεσίας: Περιέχει κανονισμούς, οδηγίες και νομικό πλαίσιο της ΕΕ'
    )
  }

  if (includeEuropeanCourtDecisions) {
    enCollections.push(
      '• European Court Decisions: Contains ECJ and ECHR case law and decisions'
    )
    elCollections.push(
      '• Ευρωπαϊκές Δικαστικές Αποφάσεις: Περιέχει νομολογία ΔΕΚ και ΕΔΔΑ'
    )
  }

  collections.en.availableCollections = enCollections.join('\n')
  collections.el.availableCollections = elCollections.join('\n')

  collections.en.searchInstructions = `Search Strategy: The system uses advanced hybrid search combining semantic similarity and keyword matching. For recent legislation, specify dates or use terms like "current", "latest", or "2024". For specific laws, include law numbers (e.g., "N. 4830/2021"). The system automatically prioritizes recent amendments and relevant provisions. For court decisions, the system intelligently filters cases based on the laws mentioned in your query, ensuring temporal compatibility and legal relevance.`

  collections.el.searchInstructions = `Στρατηγική Αναζήτησης: Το σύστημα χρησιμοποιεί προηγμένη υβριδική αναζήτηση που συνδυάζει σημασιολογική ομοιότητα και αντιστοίχιση λέξεων-κλειδιών. Για πρόσφατη νομοθεσία, καθορίστε ημερομηνίες ή χρησιμοποιήστε όρους όπως "τρέχων", "πρόσφατος", ή "2024". Για συγκεκριμένους νόμους, συμπεριλάβετε αριθμούς νόμων (π.χ. "Ν. 4830/2021"). Το σύστημα δίνει αυτόματα προτεραιότητα σε πρόσφατες τροποποιήσεις και σχετικές διατάξεις. Για δικαστικές αποφάσεις, το σύστημα φιλτράρει έξυπνα τις υποθέσεις βάσει των νόμων που αναφέρετε στην ερώτησή σας, διασφαλίζοντας χρονική συμβατότητα και νομική σχετικότητα.`

  return collections[locale]
}

/**
 * Helper function to build law network and enhance case filtering
 */
export function prepareLawDocumentsForNetworking(lawData: FilteredData): any[] {
  return lawData.fullReferences
    .map((ref) => {
      try {
        const metadataMatch = ref.match(/<metadata>([\s\S]*?)<\/metadata>/)
        if (!metadataMatch) return null

        const metadataXml = metadataMatch[1]
        const metadata: any = {}

        const extractField = (fieldName: string) => {
          const match = metadataXml.match(
            new RegExp(`<${fieldName}>([\s\S]*?)<\/${fieldName}>`)
          )
          return match ? match[1].trim() : ''
        }

        metadata.decision_number = extractField('decision_number')
        metadata.date = extractField('date')
        metadata.main_laws = extractField('main_laws')
        metadata.key_articles = extractField('key_articles')

        return { metadata }
      } catch (error) {
        verboseLog('Error parsing law document for networking:', error)
        return null
      }
    })
    .filter(Boolean)
}

/**
 * Claude-powered query analysis for enhanced legal search
 */
export async function claudeAnalyzeQuery(query: string): Promise<{
  legalCategories: string[]
  keywords: string[]
  detectedLaws: string[]
  temporalIntent: boolean
  confidence: 'high' | 'medium' | 'low'
}> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Claude analysis timeout')), 10000)
    )

    const analysisPromise = performClaudeAnalysis(query)

    const result = await Promise.race([analysisPromise, timeoutPromise])
    return result
  } catch (error) {
    console.warn('Claude analysis failed, using fallback')

    const fallbackAnalysis = analyzeQueryForSearch(query)

    return {
      legalCategories: ['γενικό'],
      keywords: extractBasicKeywords(query),
      detectedLaws: fallbackAnalysis?.lawTypes || [],
      temporalIntent: fallbackAnalysis?.requiresCurrentLaw || false,
      confidence: 'low',
    }
  }
}

/**
 * Local LLM-powered query analysis for enhanced legal search
 */
export async function localLlmAnalyzeQuery(query: string): Promise<{
  legalCategories: string[]
  keywords: string[]
  detectedLaws: string[]
  temporalIntent: boolean
  confidence: 'high' | 'medium' | 'low'
}> {
  try {
    const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://localhost:8000'
    const LLM_KEY = process.env.LLM_KEY || 'LLM_LLM'

    const analysisPrompt = `Analyze this legal query and extract structured information. Respond ONLY with valid JSON, no other text.

Query: "${query}"

Extract:
1. Legal categories (e.g., "εργατικό δίκαιο", "αστικό δίκαιο", "ποινικό δίκαιο", "διοικητικό δίκαιο")
2. Important keywords (legal terms, concepts)
3. Any law references mentioned (e.g., "Ν. 4512/2018", "ΠΔ 123/2020")
4. Whether it requires current/recent law information (true/false)

Respond with JSON in this exact format:
{
  "legalCategories": ["category1", "category2"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "detectedLaws": ["law1", "law2"],
  "temporalIntent": true or false,
  "confidence": "high" or "medium" or "low"
}`

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Local LLM analysis timeout')), 15000)
    )

    const analysisPromise = fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.1,
        max_tokens: 500,
        stream: false,
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error('Local LLM request failed')
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content

      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')

      const parsed = JSON.parse(jsonMatch[0])

      return {
        legalCategories: Array.isArray(parsed.legalCategories)
          ? parsed.legalCategories
          : ['γενικό'],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        detectedLaws: Array.isArray(parsed.detectedLaws)
          ? parsed.detectedLaws
          : [],
        temporalIntent: Boolean(parsed.temporalIntent),
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
          ? parsed.confidence
          : 'medium',
      }
    })

    const result = await Promise.race([analysisPromise, timeoutPromise])
    console.log('✅ Local LLM analysis succeeded:', result)
    return result
  } catch (error) {
    console.warn('Local LLM analysis failed, using fallback:', error)

    const fallbackAnalysis = analyzeQueryForSearch(query)

    return {
      legalCategories: ['γενικό'],
      keywords: extractBasicKeywords(query),
      detectedLaws: fallbackAnalysis?.lawTypes || [],
      temporalIntent: fallbackAnalysis?.requiresCurrentLaw || false,
      confidence: 'low',
    }
  }
}

/**
 * Internal Claude API call for legal analysis
 */
async function performClaudeAnalysis(query: string): Promise<{
  legalCategories: string[]
  keywords: string[]
  detectedLaws: string[]
  temporalIntent: boolean
  confidence: 'high' | 'medium' | 'low'
}> {
  const analysisPrompt = `Αναλύσε το παρακάτω νομικό ερώτημα και επίστρεψε ΜΟΝΟ JSON χωρίς άλλο κείμενο:

ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ: Για ΟΛΑ τα νομικά ερωτήματα απαιτείται το ΙΣΧΥΟΝ νομοθετικό πλαίσιο!
- Θέσε ΠΑΝΤΑ "temporalIntent": true
- Πρόσθεσε ΠΑΝΤΑ στα keywords: ["ισχύον", "τρέχων", "εν ισχύ"]
- Το ισχύον πλαίσιο μπορεί να περιλαμβάνει:
  * Νέους νόμους που αντικαθιστούν παλαιούς
  * Παλαιούς νόμους με τροποποιήσεις από νεότερους
  * Συνδυασμό διατάξεων από πολλούς νόμους

Ερώτημα: "${query}"

Επίστρεψε μόνο αυτό το JSON:
{
  "legalCategories": ["κατηγορία1", "κατηγορία2"],
  "keywords": ["λέξη1", "λέξη2", "ισχύον", "τρέχων", "εν ισχύ"],
  "temporalIntent": true,
  "confidence": "high/medium/low"
}`

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: analysisPrompt,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Invalid response type from Claude')
  }

  try {
    const parsed = safeJsonParse(content.text)

    return {
      legalCategories: Array.isArray(parsed.legalCategories)
        ? parsed.legalCategories
        : ['γενικό'],
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.slice(0, 10)
        : [],
      detectedLaws: [],
      temporalIntent: Boolean(parsed.temporalIntent),
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
    }
  } catch (parseError) {
    verboseLog('Failed to parse Claude analysis response:', parseError)
    throw new Error('Claude response parsing failed')
  }
}

/**
 * Robust JSON parsing for Claude responses
 */
function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch (error) {
    verboseLog('Direct JSON parse failed, trying extraction methods...')

    // Method 1: Extract JSON block
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      verboseLog('JSON block extraction failed')
    }

    // Method 2: Clean markdown
    try {
      let cleanText = text.trim()
      cleanText = cleanText.replace(/```json\s*/g, '')
      cleanText = cleanText.replace(/```\s*/g, '')

      const lines = cleanText.split('\n')
      const jsonLines = []
      let inJson = false

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('{')) {
          inJson = true
        }
        if (inJson) {
          jsonLines.push(line)
        }
        if (trimmedLine.endsWith('}') && inJson) {
          break
        }
      }

      const cleanedJson = jsonLines.join('\n')
      return JSON.parse(cleanedJson)
    } catch (e) {
      verboseLog('Markdown cleaning failed')
    }

    // Method 3: Fallback regex extraction
    try {
      const fallbackData: any = {}

      const categoriesMatch = text.match(/"legalCategories":\s*\[(.*?)\]/)
      if (categoriesMatch) {
        const categories = categoriesMatch[1]
          .split(',')
          .map((c) => c.trim().replace(/"/g, ''))
        fallbackData.legalCategories = categories
      }

      const keywordsMatch = text.match(/"keywords":\s*\[(.*?)\]/)
      if (keywordsMatch) {
        const keywords = keywordsMatch[1]
          .split(',')
          .map((k) => k.trim().replace(/"/g, ''))
        fallbackData.keywords = keywords
      }

      const lawsMatch = text.match(/"detectedLaws":\s*\[(.*?)\]/)
      if (lawsMatch) {
        const laws = lawsMatch[1]
          .split(',')
          .map((l) => l.trim().replace(/"/g, ''))
        fallbackData.detectedLaws = laws
      }

      const temporalMatch = text.match(/"temporalIntent":\s*(true|false)/)
      if (temporalMatch) {
        fallbackData.temporalIntent = temporalMatch[1] === 'true'
      }

      const confidenceMatch = text.match(/"confidence":\s*"(high|medium|low)"/)
      if (confidenceMatch) {
        fallbackData.confidence = confidenceMatch[1]
      }

      if (Object.keys(fallbackData).length > 0) {
        return {
          legalCategories: fallbackData.legalCategories || ['γενικό'],
          keywords: fallbackData.keywords || [],
          detectedLaws: fallbackData.detectedLaws || [],
          temporalIntent: fallbackData.temporalIntent || false,
          confidence: fallbackData.confidence || 'low',
        }
      }
    } catch (e) {
      verboseLog('Fallback regex extraction failed')
    }

    throw new Error(`Unable to parse JSON`)
  }
}

/**
 * Simple keyword extraction fallback
 */
function extractBasicKeywords(query: string): string[] {
  const commonLegalTerms = [
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
    'νόμος',
    'άρθρο',
    'διάταγμα',
    'τροπολογία',
    'ΦΕΚ',
    'κυριότητα',
    'μίσθωση',
    'πώληση',
    'αγορά',
    'εταιρεία',
    'μετοχή',
    'φόρος',
    'ΦΠΑ',
    'εισόδημα',
  ]

  const queryLower = query.toLowerCase()
  const foundTerms = commonLegalTerms.filter((term) =>
    queryLower.includes(term)
  )

  return foundTerms.slice(0, 5)
}

// Export constants
export const MAX_FILE_CHARS = 3000
export const MAX_RESULTS_PER_SOURCE = 15
export const MAX_LAW_CHARACTERS_V1 = 250_000
export const MAX_LAW_CHARACTERS_V2 = 150_000
export const MAX_PASTCASE_CHARACTERS = 175_000
export const RERANKED_K = 18
export const LAW_RERANKED_K = 24
export const CASE_RERANKED_K = 24
export const TOTAL_RERANKED_K = 48

export type { EnhancedRetrievalOptions }
