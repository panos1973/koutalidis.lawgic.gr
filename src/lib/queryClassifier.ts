import Anthropic from '@anthropic-ai/sdk'

// Debug mode control
const DEBUG_MODE =
  process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development'

function debugLog(message: string, data?: any) {
  if (DEBUG_MODE) {
    if (data !== undefined) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}

// ─── Query Classification Types ──────────────────────────────────────────────

export type QueryType =
  | 'simple_lookup'
  | 'temporal'
  | 'multi_hop'
  | 'comparative'

export interface QueryClassification {
  queryType: QueryType
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  // Metadata for routing decisions
  detectedLaws: string[]
  temporalIndicators: string[]
  comparisonEntities: string[]
  hopsRequired: number
  suggestedSources: string[]
}

// ─── Pattern-Based Fast Classifier (fallback, ~0ms) ─────────────────────────

const TEMPORAL_PATTERNS = [
  // Greek temporal indicators
  /τροποποι[ηή]θηκε|τροποποίηση/i,
  /καταργ[ηή]θηκε|κατάργηση/i,
  /αντικαταστ[αά]θηκε|αντικατάσταση/i,
  /ισχύ[εο]ι\s*(ακόμα|ακόμη)?/i,
  /εξακολουθ[εεί]\s*να\s*ισχύ[εο]ι/i,
  /πρόσφατ[ηο]ς?\s*(τροποποίηση|αλλαγή|νόμος)/i,
  /μετά\s*τ[ηο]ν?\s*ν\.\s*\d+/i,
  /πρ[ιί]ν\s*τ[ηο]ν?\s*ν\.\s*\d+/i,
  /ποι[αοό]ς?\s*νόμος\s*(αντικατέστησε|κατάργησε|τροποποίησε)/i,
  /τι\s*(ισχύει|ίσχυε)\s*(σήμερα|τώρα|πλέον)/i,
  /αλλαγ[έή]\s*(στ[ηο]ν?|τ[ηο]υ)\s*νόμ[οου]/i,
  /ν[εέ][οό]ς?\s*νόμος\s*(αντ[ιί]|για|που|περ[ιί])/i,
  // English temporal indicators
  /still\s*(valid|in\s*effect|applicable)/i,
  /been\s*(amended|repealed|replaced|modified)/i,
  /current\s*(version|status|law)/i,
  /latest\s*(amendment|version|update)/i,
  /what\s*(replaced|amended|repealed)/i,
  /history\s*of\s*(law|article|provision)/i,
  /changes?\s*(to|in|since)\s*(the\s*)?(law|article)/i,
]

const MULTI_HOP_PATTERNS = [
  // Multi-step legal reasoning
  /πρ[οό]ϋποθ[εέ]σεις.*και.*συν[εέ]πειες/i,
  /αν\s*.+τότε\s*.+αλλιώς/i,
  /ποι[αοό]\s*(είναι|ήταν)\s*(τα|η)\s*(βήματα|διαδικασία)/i,
  /σε\s*συνδυασμό\s*με/i,
  /κατ['']?\s*εφαρμογ[ηή]/i,
  /σύμφωνα\s*με\s*τ[οα]\s*άρθρ[οα]\s*\d+.*και.*άρθρ[οα]\s*\d+/i,
  /πώς\s*(εφαρμόζ[εο]ται|εφαρμόζονται|συνδυάζ[εο]ται)/i,
  /μετατρ[εο]π[ηή]\s*.+σε\s*.+/i,
  /φορολογικ[εέής]\s*συν[εέ]πειες\s*(τ[ηο]ς|μιας|ενός)/i,
  /δικαιώματα.*και.*υποχρεώσεις/i,
  // English multi-hop
  /implications?\s*of\s*.*\s*(for|on|to)/i,
  /steps?\s*(required|needed|to)\s*(for|to)/i,
  /in\s*combination\s*with/i,
  /requirements?\s*for.*and.*also/i,
  /what\s*happens\s*if.*and.*then/i,
  /procedure\s*for\s*(converting|transferring|establishing)/i,
]

const COMPARATIVE_PATTERNS = [
  // Greek comparative indicators
  /σ[υύ]γκρι[σ]η|σύγκριν[εα]/i,
  /διαφορ[άέ][ές]?\s*(μεταξύ|ανάμεσα|τ[ηο]υ)/i,
  /ποι[αοό]\s*(είναι|ήταν)\s*(η|οι)\s*διαφορ/i,
  /σε\s*σχέση\s*με/i,
  /αντίθετ[αηο]|αντίθεση/i,
  /ελληνικ[όή]\s*(δίκαιο|νομοθεσία).*ευρωπαϊκ/i,
  /ευρωπαϊκ[όή].*ελληνικ/i,
  /σε\s*αντιδιαστολή/i,
  /από\s*τ[ηο]\s*[εέ]να\s*(πλευρά|μέρος).*από\s*τ[ηο]\s*άλλ[ηο]/i,
  /αντιφατικ[ηέ][ες]?\s*(αποφ[αά]σεις|νομολογ[ιί]α)/i,
  /πώς\s*διαφέρ[εο]ι/i,
  // English comparative indicators
  /compar(e|ison|ing)/i,
  /differ(ence|s|ent)\s*(between|from)/i,
  /versus|vs\.?\s/i,
  /greek.*eu|eu.*greek/i,
  /on\s*the\s*other\s*hand/i,
  /conflicting\s*(decisions|rulings|case\s*law)/i,
  /how\s*does.*differ/i,
]

// Patterns that suggest a simple direct lookup
const SIMPLE_LOOKUP_PATTERNS = [
  /τι\s*(λέει|ορίζει|προβλέπει)\s*(το\s*)?άρθρο\s*\d+/i,
  /άρθρο\s*\d+\s*(τ[ηο]υ|ν\.|νόμου)\s*\d+/i,
  /ν\.\s*\d+\/\d{4}/i,
  /ορισμός\s*(τ[ηο]υ|τ[ηο]ς|ενός)/i,
  /what\s*(does|is)\s*(article|law|provision)/i,
  /define|definition\s*of/i,
  /ποι[αοό]\s*(είναι|ήταν)\s*(ο|η|το)\s*(ορισμός|έννοια)/i,
]

/**
 * Fast pattern-based classifier (~0ms, no API calls)
 * Used as fallback when Haiku is unavailable or for cost savings
 */
export function classifyQueryByPatterns(query: string): QueryClassification {
  const detectedLaws: string[] = []
  const temporalIndicators: string[] = []
  const comparisonEntities: string[] = []

  // Extract law references
  const lawPatterns = [
    /[Νν]\.\s*\d+\/\d{4}/g,
    /νόμος\s*\d+\/\d{4}/gi,
    /ΠΔ\.?\s*\d+\/\d{4}/g,
    /ΥΑ\.?\s*\d+\/\d{4}/g,
  ]
  lawPatterns.forEach((pattern) => {
    const matches = query.match(pattern)
    if (matches) detectedLaws.push(...matches)
  })

  // Count pattern matches for each type
  let temporalScore = 0
  let multiHopScore = 0
  let comparativeScore = 0
  let simpleScore = 0

  TEMPORAL_PATTERNS.forEach((pattern) => {
    if (pattern.test(query)) {
      temporalScore++
      const match = query.match(pattern)
      if (match) temporalIndicators.push(match[0])
    }
  })

  MULTI_HOP_PATTERNS.forEach((pattern) => {
    if (pattern.test(query)) multiHopScore++
  })

  COMPARATIVE_PATTERNS.forEach((pattern) => {
    if (pattern.test(query)) {
      comparativeScore++
      const match = query.match(pattern)
      if (match) comparisonEntities.push(match[0])
    }
  })

  SIMPLE_LOOKUP_PATTERNS.forEach((pattern) => {
    if (pattern.test(query)) simpleScore++
  })

  // Additional heuristics
  const queryLength = query.length
  const questionMarkCount = (query.match(/;|\?/g) || []).length

  // Multiple questions suggest multi-hop
  if (questionMarkCount >= 2) multiHopScore += 1

  // Very short queries are usually simple
  if (queryLength < 50) simpleScore += 2

  // Long complex queries are usually multi-hop or comparative
  if (queryLength > 200) {
    multiHopScore += 0.5
    comparativeScore += 0.5
  }

  // Multiple law references suggest comparative or multi-hop
  if (detectedLaws.length >= 2) {
    comparativeScore += 1
    multiHopScore += 0.5
  }

  // Determine query type based on scores
  const scores: Record<QueryType, number> = {
    simple_lookup: simpleScore,
    temporal: temporalScore,
    multi_hop: multiHopScore,
    comparative: comparativeScore,
  }

  // Find the winning type
  let maxScore = 0
  let queryType: QueryType = 'simple_lookup'
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      queryType = type as QueryType
    }
  }

  // If no strong signal, default to simple_lookup
  if (maxScore < 1) {
    queryType = 'simple_lookup'
  }

  const confidence =
    maxScore >= 3 ? 'high' : maxScore >= 1.5 ? 'medium' : 'low'

  return {
    queryType,
    confidence,
    reasoning: `Pattern-based: scores={simple:${simpleScore}, temporal:${temporalScore}, multi_hop:${multiHopScore}, comparative:${comparativeScore}}`,
    detectedLaws,
    temporalIndicators,
    comparisonEntities,
    hopsRequired: queryType === 'multi_hop' ? 2 : 1,
    suggestedSources: determineSuggestedSources(queryType, query),
  }
}

// ─── Haiku-Based Classifier (~200ms, costs ~$0.0002 per call) ────────────────

/**
 * Classifies a legal query using Claude Haiku for accurate routing.
 * Falls back to pattern-based classification on failure.
 */
export async function classifyQuery(
  query: string
): Promise<QueryClassification> {
  try {
    const startTime = Date.now()

    const result = await classifyWithHaiku(query)

    const elapsed = Date.now() - startTime
    console.log(
      `[QueryClassifier] Haiku classification: ${result.queryType} (${result.confidence}) in ${elapsed}ms`
    )

    return result
  } catch (error) {
    console.warn(
      '[QueryClassifier] Haiku classification failed, using pattern fallback:',
      error instanceof Error ? error.message : String(error)
    )
    return classifyQueryByPatterns(query)
  }
}

async function classifyWithHaiku(query: string): Promise<QueryClassification> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Classification timeout')), 5000)
  )

  const classificationPromise = performHaikuClassification(query)

  return await Promise.race([classificationPromise, timeoutPromise])
}

async function performHaikuClassification(
  query: string
): Promise<QueryClassification> {
  const prompt = `Classify this legal query into exactly ONE category. Respond ONLY with valid JSON.

Categories:
1. "simple_lookup" - Direct question about a specific law, article, or definition. Single retrieval needed.
   Examples: "What does Article 5 of Law 4548/2018 say?", "Definition of force majeure in Greek law"
2. "temporal" - Questions about law changes, amendments, validity over time, or current vs old law.
   Examples: "Has Law 2112/1920 on dismissals been amended?", "Is a 2019 employment contract still valid?"
3. "multi_hop" - Complex questions requiring multiple legal concepts, procedures, or combining provisions from different laws.
   Examples: "What are the tax implications of converting a sole proprietorship to an LLC?", "Steps to challenge an administrative act and seek damages"
4. "comparative" - Questions comparing legal frameworks, jurisdictions, or conflicting case law.
   Examples: "How do Greek and EU data protection laws differ?", "Conflicting rulings on employee non-compete clauses"

Query: "${query.replace(/"/g, '\\"').substring(0, 500)}"

Respond with:
{
  "queryType": "simple_lookup|temporal|multi_hop|comparative",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation",
  "detectedLaws": ["law references found"],
  "hopsRequired": 1,
  "comparisonEntities": []
}`

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Invalid response type')
  }

  const parsed = parseClassificationResponse(content.text)
  const patternResult = classifyQueryByPatterns(query)

  // Merge Haiku result with pattern-detected metadata
  return {
    queryType: parsed.queryType,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning || 'Haiku classification',
    detectedLaws: [
      ...new Set([
        ...(parsed.detectedLaws || []),
        ...patternResult.detectedLaws,
      ]),
    ],
    temporalIndicators: patternResult.temporalIndicators,
    comparisonEntities: [
      ...new Set([
        ...(parsed.comparisonEntities || []),
        ...patternResult.comparisonEntities,
      ]),
    ],
    hopsRequired: parsed.hopsRequired || 1,
    suggestedSources: determineSuggestedSources(parsed.queryType, query),
  }
}

function parseClassificationResponse(text: string): {
  queryType: QueryType
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  detectedLaws: string[]
  hopsRequired: number
  comparisonEntities: string[]
} {
  // Try direct JSON parse
  try {
    const result = JSON.parse(text)
    return validateClassification(result)
  } catch {
    // Try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0])
        return validateClassification(result)
      } catch {
        // Fall through
      }
    }

    // Extract queryType at minimum
    const typeMatch = text.match(
      /"queryType"\s*:\s*"(simple_lookup|temporal|multi_hop|comparative)"/
    )
    if (typeMatch) {
      return {
        queryType: typeMatch[1] as QueryType,
        confidence: 'low',
        reasoning: 'Partial parse',
        detectedLaws: [],
        hopsRequired: 1,
        comparisonEntities: [],
      }
    }

    throw new Error('Could not parse classification response')
  }
}

function validateClassification(result: any): {
  queryType: QueryType
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  detectedLaws: string[]
  hopsRequired: number
  comparisonEntities: string[]
} {
  const validTypes: QueryType[] = [
    'simple_lookup',
    'temporal',
    'multi_hop',
    'comparative',
  ]
  const validConfidences = ['high', 'medium', 'low']

  return {
    queryType: validTypes.includes(result.queryType)
      ? result.queryType
      : 'simple_lookup',
    confidence: validConfidences.includes(result.confidence)
      ? result.confidence
      : 'medium',
    reasoning: result.reasoning || '',
    detectedLaws: Array.isArray(result.detectedLaws)
      ? result.detectedLaws
      : [],
    hopsRequired:
      typeof result.hopsRequired === 'number' ? result.hopsRequired : 1,
    comparisonEntities: Array.isArray(result.comparisonEntities)
      ? result.comparisonEntities
      : [],
  }
}

// ─── Source Suggestion Logic ─────────────────────────────────────────────────

function determineSuggestedSources(
  queryType: QueryType,
  query: string
): string[] {
  const sources: string[] = []
  const queryLower = query.toLowerCase()

  // Always include main law collection
  sources.push('greek_laws_collection')

  // EU indicators
  const hasEU =
    /eu|ευρωπ|directive|οδηγία|regulation|κανονισμός|eur-lex/i.test(query)
  if (hasEU) {
    sources.push('eu_sources')
  }

  switch (queryType) {
    case 'simple_lookup':
      // Single source usually sufficient
      if (
        queryLower.includes('απόφαση') ||
        queryLower.includes('δικαστ') ||
        queryLower.includes('νομολογ') ||
        queryLower.includes('court') ||
        queryLower.includes('decision') ||
        queryLower.includes('ruling')
      ) {
        sources.push('dev_greek_court')
      }
      break

    case 'temporal':
      // Need multiple sources to track amendments
      sources.push('dev_greek_court')
      sources.push('internet_perplexity') // For recent amendments
      break

    case 'multi_hop':
      // Need comprehensive coverage
      sources.push('dev_greek_court')
      sources.push('internet_perplexity')
      sources.push('internet_youcom')
      break

    case 'comparative':
      // Need all sources for comprehensive comparison
      sources.push('dev_greek_court')
      sources.push('internet_perplexity')
      sources.push('internet_youcom')
      if (hasEU) {
        sources.push('internet_deepseek')
      }
      break
  }

  return sources
}

// ─── Export convenience function ─────────────────────────────────────────────

/**
 * Quick synchronous classification for cases where latency matters most.
 * Use classifyQuery() for better accuracy when ~200ms latency is acceptable.
 */
export { classifyQueryByPatterns as classifyQueryFast }
