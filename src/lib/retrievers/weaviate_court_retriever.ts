// Weaviate Court Decision Retriever
// Retrieves Greek court decisions from the GreekCourtContext collection
// Uses shared Weaviate client (voyage-context-3 embeddings, 1024d)
// Supports hybrid search (vector + BM25) with rich metadata filtering

import {
  WEAVIATE_CONFIG,
  COLLECTIONS,
  getQueryEmbedding,
  executeWeaviateQuery,
  escapeXml,
  createXmlTag,
  arrayToXml,
} from './weaviate_client'

// ─── Legacy support: keep old cluster config for Test_GreekCourtDecision fallback ──
// If the new GreekCourtContext collection is not yet populated, we fall back to the old cluster
const LEGACY_WEAVIATE_URL = process.env.WEAVIATE_URL_LAWNCOURT || 'lqtwyfnvr6cm2wskqhv1a.c0.europe-west3.gcp.weaviate.cloud'
const LEGACY_WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY_LAWNCOURT || 'Uko3WUx2ZkZZeWs4cWJBUl9qTWN6bE8xQUE0NUhkejE4aVE3TUV6QnE0bWtXWGd0dWd3MWtFaHZLNTRjPV92MjAw'
const LEGACY_COLLECTION = process.env.WEAVIATE_COLLECTION_COURT || 'Test_GreekCourtDecision'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeaviateCourtResult {
  aiVersion: string
  fullReference: string
}

export interface CourtSearchOptions {
  /** Number of results (default: 20) */
  limit?: number
  /** Hybrid alpha: 0 = pure BM25, 1 = pure vector, 0.5 = balanced */
  alpha?: number
  /** Filter by court ID (e.g., "AP", "STE", "EF_ATH") */
  courtId?: string
  /** Filter by court category */
  courtCategory?: 'civil' | 'criminal' | 'administrative' | 'regulatory' | 'european'
  /** Filter by court level (1=Supreme, 2=Appeal, 3=First Instance) */
  courtLevel?: number
  /** Filter by legal domain */
  legalDomain?: string[]
  /** Filter by year */
  year?: number
  /** Only landmark decisions */
  landmarkOnly?: boolean
  /** Filter by ruling outcome */
  rulingOutcome?: string
  /** Filter by chunk section type */
  chunkSectionType?: string
}

// ─── New GreekCourtContext Search ────────────────────────────────────────────

const COURT_FIELDS = `
  chunk_text
  chunk_summary
  citation_label
  court_id
  court_name
  court_category
  court_level
  year
  decision_date
  legal_domain
  ruling_outcome
  is_landmark
  has_dissent
  laws_cited
  cases_cited
  summary
  outcome_summary
  ruling_text
  key_findings
  legal_issues
  tags
  semantic_tags_en
  chunk_section_type
  ecli
  _additional { score distance id }
`

function buildCourtWhereFilter(options: CourtSearchOptions): string {
  const conditions: string[] = []

  if (options.courtId) {
    conditions.push(`{ path: ["court_id"], operator: Equal, valueText: "${options.courtId}" }`)
  }
  if (options.courtCategory) {
    conditions.push(`{ path: ["court_category"], operator: Equal, valueText: "${options.courtCategory}" }`)
  }
  if (options.courtLevel !== undefined) {
    conditions.push(`{ path: ["court_level"], operator: Equal, valueInt: ${options.courtLevel} }`)
  }
  if (options.legalDomain && options.legalDomain.length > 0) {
    conditions.push(`{ path: ["legal_domain"], operator: ContainsAny, valueText: ${JSON.stringify(options.legalDomain)} }`)
  }
  if (options.year) {
    conditions.push(`{ path: ["year"], operator: Equal, valueInt: ${options.year} }`)
  }
  if (options.landmarkOnly) {
    conditions.push(`{ path: ["is_landmark"], operator: Equal, valueBoolean: true }`)
  }
  if (options.rulingOutcome) {
    conditions.push(`{ path: ["ruling_outcome"], operator: Equal, valueText: "${options.rulingOutcome}" }`)
  }
  if (options.chunkSectionType) {
    conditions.push(`{ path: ["chunk_section_type"], operator: Equal, valueText: "${options.chunkSectionType}" }`)
  }

  if (conditions.length === 0) return ''
  if (conditions.length === 1) return `where: ${conditions[0]}`
  return `where: { operator: And, operands: [${conditions.join(', ')}] }`
}

function processNewCourtHit(source: any): WeaviateCourtResult {
  const contentField = source.chunk_text || source.summary || 'No content available.'

  // AI version — essential metadata for LLM context
  const aiMetadataParts = [
    createXmlTag('citation', source.citation_label),
    createXmlTag('court_name', source.court_name),
    createXmlTag('court_id', source.court_id),
    createXmlTag('court_category', source.court_category),
    createXmlTag('decision_date', source.decision_date),
    createXmlTag('ruling_outcome', source.ruling_outcome),
    createXmlTag('is_landmark', source.is_landmark),
    arrayToXml('legal_domain', source.legal_domain),
    arrayToXml('laws_cited', source.laws_cited),
    createXmlTag('outcome_summary', source.outcome_summary),
    createXmlTag('chunk_section_type', source.chunk_section_type),
    createXmlTag('chunk_summary', source.chunk_summary),
  ].filter(Boolean)

  const aiVersion = `<court_source>
  <metadata>
    ${aiMetadataParts.join('\n    ')}
  </metadata>
</court_source>`

  // Full reference — comprehensive metadata for citations
  const fullMetadataParts = [
    createXmlTag('citation', source.citation_label),
    createXmlTag('court_name', source.court_name),
    createXmlTag('court_id', source.court_id),
    createXmlTag('court_category', source.court_category),
    createXmlTag('court_level', source.court_level),
    createXmlTag('year', source.year),
    createXmlTag('decision_date', source.decision_date),
    createXmlTag('ecli', source.ecli),
    createXmlTag('ruling_outcome', source.ruling_outcome),
    createXmlTag('is_landmark', source.is_landmark),
    createXmlTag('has_dissent', source.has_dissent),
    arrayToXml('legal_domain', source.legal_domain),
    arrayToXml('laws_cited', source.laws_cited),
    arrayToXml('cases_cited', source.cases_cited),
    createXmlTag('summary', source.summary),
    createXmlTag('outcome_summary', source.outcome_summary),
    createXmlTag('ruling_text', source.ruling_text),
    arrayToXml('key_findings', source.key_findings),
    arrayToXml('legal_issues', source.legal_issues),
    arrayToXml('tags', source.tags),
    arrayToXml('semantic_tags_en', source.semantic_tags_en),
    createXmlTag('chunk_section_type', source.chunk_section_type),
  ].filter(Boolean)

  const fullReference = `<court_source>
  <metadata>
    ${fullMetadataParts.join('\n    ')}
  </metadata>
  <content>
${escapeXml(contentField)}
  </content>
</court_source>`

  return { aiVersion, fullReference }
}

/**
 * Hybrid search on GreekCourtContext collection.
 */
async function searchNewCourtCollection(
  query: string,
  options: CourtSearchOptions = {}
): Promise<WeaviateCourtResult[]> {
  const embedding = await getQueryEmbedding(query)
  if (!embedding) {
    console.warn('⚠️ No embedding for court search, trying BM25-only...')
    try {
      const limit = options.limit || 20
      const whereClause = buildCourtWhereFilter(options)
      const bm25Query = `{
        Get {
          ${COLLECTIONS.COURT_CONTEXT}(
            bm25: {
              query: "${query.replace(/"/g, '\\"')}"
              properties: ["chunk_text_stemmed", "chunk_summary_stemmed", "summary_stemmed", "outcome_summary_stemmed", "ruling_text_stemmed"]
            }
            ${whereClause}
            limit: ${limit}
          ) {
            ${COURT_FIELDS}
          }
        }
      }`
      const data = await executeWeaviateQuery(bm25Query)
      const results = data?.Get?.[COLLECTIONS.COURT_CONTEXT] || []
      return results.map((hit: any) => processNewCourtHit(hit))
    } catch {
      return []
    }
  }

  const limit = options.limit || 20
  const alpha = options.alpha ?? 0.5
  const whereClause = buildCourtWhereFilter(options)

  const graphqlQuery = `{
    Get {
      ${COLLECTIONS.COURT_CONTEXT}(
        hybrid: {
          query: "${query.replace(/"/g, '\\"')}"
          alpha: ${alpha}
          vector: [${embedding.join(',')}]
        }
        ${whereClause}
        limit: ${limit}
      ) {
        ${COURT_FIELDS}
      }
    }
  }`

  try {
    const data = await executeWeaviateQuery(graphqlQuery)
    const results = data?.Get?.[COLLECTIONS.COURT_CONTEXT] || []
    console.log(`✅ Weaviate GreekCourtContext: ${results.length} results`)
    return results.map((hit: any) => processNewCourtHit(hit))
  } catch (error) {
    console.error('❌ GreekCourtContext search failed:', error)
    return []
  }
}

// ─── Legacy Court Search (Test_GreekCourtDecision on old cluster) ───────────

function processLegacyCourtHit(source: any): WeaviateCourtResult {
  const contentField =
    source.chunk_text ||
    source.full_text ||
    source.summary_ai_generated ||
    source.content ||
    'No content available.'

  const aiEssentialFields = [
    'court', 'court_name', 'decision_number', 'decision_date',
    'case_type', 'relevant_laws', 'court_level', 'summary_ai_generated', 'pdf_url',
  ]

  const aiMetadataParts: string[] = []
  for (const field of aiEssentialFields) {
    const value = source[field]
    if (value !== undefined && value !== null && value !== '' && value !== 'N/A') {
      aiMetadataParts.push(createXmlTag(field, value))
    }
  }

  const fullMetadataParts: string[] = []
  for (const [key, value] of Object.entries(source)) {
    if (['embedding', 'chunk_text', 'full_text', '_additional'].includes(key)) continue
    if (value !== undefined && value !== null && value !== '' && value !== 'N/A') {
      fullMetadataParts.push(createXmlTag(key, value as string))
    }
  }

  const aiVersion = `<court_source>
    <metadata>
      ${aiMetadataParts.filter(Boolean).join('\n      ')}
    </metadata>
</court_source>`

  const fullReference = `<court_source>
    <metadata>
      ${fullMetadataParts.filter(Boolean).join('\n      ')}
    </metadata>
    <content>
${escapeXml(contentField)}
    </content>
</court_source>`

  return { aiVersion, fullReference }
}

async function searchLegacyCourtCollection(
  query: string,
  maxResults: number = 20
): Promise<WeaviateCourtResult[]> {
  const embedding = await getQueryEmbedding(query)
  if (!embedding) {
    console.warn('⚠️ No embedding available for legacy court search')
    return []
  }

  console.log(`📚 Legacy court search on ${LEGACY_COLLECTION} (${LEGACY_WEAVIATE_URL})`)

  const graphqlBody = {
    query: `{
      Get {
        ${LEGACY_COLLECTION}(
          nearVector: {
            vector: [${embedding.join(',')}]
          }
          limit: ${maxResults}
        ) {
          chunk_text
          full_text
          summary_ai_generated
          court
          court_name
          decision_number
          decision_date
          case_type
          relevant_laws
          related_law_provisions
          primary_legal_basis
          court_level
          court_location
          legal_principles_established
          judicial_reasoning_pro
          judicial_reasoning_contra
          pdf_url
          document_id
          _additional {
            distance
            id
          }
        }
      }
    }`,
  }

  try {
    const endpoint = LEGACY_WEAVIATE_URL.startsWith('http')
      ? LEGACY_WEAVIATE_URL
      : `https://${LEGACY_WEAVIATE_URL}`

    const response = await fetch(`${endpoint}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LEGACY_WEAVIATE_API_KEY}`,
      },
      body: JSON.stringify(graphqlBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Legacy Weaviate error: ${response.status} - ${errorText}`)
      return []
    }

    const data = await response.json()
    if (data.errors?.length > 0) {
      console.error('❌ Legacy Weaviate GraphQL errors:', JSON.stringify(data.errors))
      return []
    }

    const results = data?.data?.Get?.[LEGACY_COLLECTION]
    if (!results || results.length === 0) {
      console.log('📚 No legacy court results found')
      return []
    }

    console.log(`✅ Legacy Weaviate: ${results.length} court decisions`)
    return results.map((hit: any) => {
      const { _additional, ...source } = hit
      return processLegacyCourtHit(source)
    })
  } catch (error) {
    console.error('❌ Legacy court search error:', error)
    return []
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Court search: tries GreekCourtContext first, falls back to legacy collection.
 * This provides seamless migration — once GreekCourtContext is populated,
 * it will be used automatically.
 */
export async function weaviateCourtSearch(
  query: string,
  maxResults: number = 20,
  options: CourtSearchOptions = {}
): Promise<WeaviateCourtResult[]> {
  // Try new GreekCourtContext collection first
  try {
    console.log('📚 Attempting GreekCourtContext search (new cluster)...')
    const newResults = await searchNewCourtCollection(query, { ...options, limit: maxResults })
    if (newResults.length > 0) {
      console.log(`✅ GreekCourtContext returned ${newResults.length} results`)
      return newResults
    }
    console.log('⚠️ GreekCourtContext returned no results, trying legacy collection...')
  } catch (error) {
    console.warn('⚠️ GreekCourtContext search failed, trying legacy collection:', error)
  }

  // Fallback to legacy Test_GreekCourtDecision
  return searchLegacyCourtCollection(query, maxResults)
}

/**
 * Retrieve court decisions with character budget management.
 * Compatible with the existing chat route interface.
 */
export async function retrieveCourtDecisionsFromWeaviate(
  query: string,
  maxCharacters: number,
  options: CourtSearchOptions = {}
): Promise<{ aiVersions: string[]; fullReferences: string[]; referenceTypes: string[] }> {
  try {
    const results = await weaviateCourtSearch(query, 20, options)

    if (results.length === 0) {
      return { aiVersions: [], fullReferences: [], referenceTypes: [] }
    }

    const filtered = {
      aiVersions: [] as string[],
      fullReferences: [] as string[],
      referenceTypes: [] as string[],
    }

    let totalChars = 0
    for (const result of results) {
      if (totalChars + result.aiVersion.length <= maxCharacters) {
        filtered.aiVersions.push(result.aiVersion)
        filtered.fullReferences.push(result.fullReference)
        filtered.referenceTypes.push('greek_case')
        totalChars += result.aiVersion.length
      } else {
        const remaining = maxCharacters - totalChars
        if (remaining > 200) {
          filtered.aiVersions.push(result.aiVersion.substring(0, remaining - 3) + '...')
          filtered.fullReferences.push(result.fullReference)
          filtered.referenceTypes.push('greek_case')
        }
        break
      }
    }

    console.log(`✅ Weaviate court retrieval: ${filtered.aiVersions.length} documents (${totalChars} chars)`)
    return filtered
  } catch (error) {
    console.error('❌ Weaviate court retrieval failed:', error)
    return { aiVersions: [], fullReferences: [], referenceTypes: [] }
  }
}
