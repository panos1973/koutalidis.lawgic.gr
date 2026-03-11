// Weaviate Law Retriever
// Searches GreekLegalDocuments collection (~412K chunks) using hybrid search
// Supports semantic (vector), keyword (BM25), and hybrid (vector + BM25) modes
// All vectors: voyage-context-3 (1024 dimensions)

import {
  WEAVIATE_CONFIG,
  COLLECTIONS,
  getQueryEmbedding,
  executeWeaviateQuery,
  escapeXml,
  createXmlTag,
  arrayToXml,
} from './weaviate_client'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WeaviateLawResult {
  aiVersion: string
  fullReference: string
  referenceType: string
  lawNumber?: string
  articleNumber?: string
  legalDomain?: string[]
  score?: number
}

export interface WeaviateLawSearchOptions {
  /** Number of results to return (default: 20) */
  limit?: number
  /** Hybrid alpha: 0 = pure BM25, 1 = pure vector, 0.5 = balanced (default: 0.5) */
  alpha?: number
  /** Filter by legal domain */
  legalDomain?: string[]
  /** Filter by specific law number (e.g., "5090/2024") */
  lawNumber?: string
  /** Filter by legal force status */
  legalForceStatus?: 'in_force' | 'repealed' | 'amended'
  /** Filter by document type */
  documentType?: string
  /** Filter by content flags */
  contentFlags?: string[]
  /** Maximum character budget for results */
  maxCharacters?: number
}

// ─── Filter Builder ─────────────────────────────────────────────────────────

function buildWhereFilter(options: WeaviateLawSearchOptions): string {
  const conditions: string[] = []

  if (options.legalDomain && options.legalDomain.length > 0) {
    conditions.push(
      `{ path: ["legal_domain"], operator: ContainsAny, valueText: ${JSON.stringify(options.legalDomain)} }`
    )
  }

  if (options.lawNumber) {
    conditions.push(
      `{ path: ["law_number"], operator: Equal, valueText: "${options.lawNumber}" }`
    )
  }

  if (options.legalForceStatus) {
    conditions.push(
      `{ path: ["legal_force_status"], operator: Equal, valueText: "${options.legalForceStatus}" }`
    )
  }

  if (options.documentType) {
    conditions.push(
      `{ path: ["document_type"], operator: Equal, valueText: "${options.documentType}" }`
    )
  }

  if (options.contentFlags && options.contentFlags.length > 0) {
    conditions.push(
      `{ path: ["content_flags"], operator: ContainsAny, valueText: ${JSON.stringify(options.contentFlags)} }`
    )
  }

  if (conditions.length === 0) return ''
  if (conditions.length === 1) return `where: ${conditions[0]}`
  return `where: { operator: And, operands: [${conditions.join(', ')}] }`
}

// ─── GraphQL Query Builders ─────────────────────────────────────────────────

const LAW_FIELDS = `
  chunk_text
  chunk_summary
  law_number
  article_number
  article_title
  document_title
  hierarchy_path
  legal_domain
  legal_force_status
  content_flags
  keywords
  subject_areas
  semantic_tags_en
  external_law_references
  amends_provisions
  amended_by_provisions
  entities_mentioned
  affected_entities
  amendment_type
  legal_effect
  issuing_authority
  fek_reference
  document_type
  publication_date
  file_url
  source_url
  chunk_index
  total_chunks
  _additional { score distance id }
`

function buildHybridQuery(
  query: string,
  embedding: number[],
  options: WeaviateLawSearchOptions
): string {
  const limit = options.limit || 20
  const alpha = options.alpha ?? 0.5
  const whereClause = buildWhereFilter(options)

  return `{
    Get {
      ${COLLECTIONS.LEGAL_DOCUMENTS}(
        hybrid: {
          query: "${query.replace(/"/g, '\\"')}"
          alpha: ${alpha}
          vector: [${embedding.join(',')}]
        }
        ${whereClause ? whereClause : ''}
        limit: ${limit}
      ) {
        ${LAW_FIELDS}
      }
    }
  }`
}

function buildVectorOnlyQuery(
  embedding: number[],
  options: WeaviateLawSearchOptions
): string {
  const limit = options.limit || 20
  const whereClause = buildWhereFilter(options)

  return `{
    Get {
      ${COLLECTIONS.LEGAL_DOCUMENTS}(
        nearVector: {
          vector: [${embedding.join(',')}]
        }
        ${whereClause ? whereClause : ''}
        limit: ${limit}
      ) {
        ${LAW_FIELDS}
      }
    }
  }`
}

function buildBm25Query(
  query: string,
  options: WeaviateLawSearchOptions
): string {
  const limit = options.limit || 20
  const whereClause = buildWhereFilter(options)

  return `{
    Get {
      ${COLLECTIONS.LEGAL_DOCUMENTS}(
        bm25: {
          query: "${query.replace(/"/g, '\\"')}"
          properties: ["chunk_text_stemmed", "chunk_summary_stemmed", "article_title_stemmed", "document_title_stemmed"]
        }
        ${whereClause ? whereClause : ''}
        limit: ${limit}
      ) {
        ${LAW_FIELDS}
      }
    }
  }`
}

// ─── Result Processing ──────────────────────────────────────────────────────

function processLawHit(source: any): WeaviateLawResult {
  const chunkText = source.chunk_text || 'No content available.'

  // AI version — compact metadata + text for LLM context
  const aiMetadataParts = [
    createXmlTag('law_number', source.law_number),
    createXmlTag('article_number', source.article_number),
    createXmlTag('article_title', source.article_title),
    createXmlTag('hierarchy_path', source.hierarchy_path),
    createXmlTag('legal_force_status', source.legal_force_status),
    createXmlTag('amendment_type', source.amendment_type),
    arrayToXml('legal_domain', source.legal_domain),
    arrayToXml('keywords', source.keywords),
    createXmlTag('chunk_summary', source.chunk_summary),
  ].filter(Boolean)

  const aiVersion = `<law_source>
  <metadata>
    ${aiMetadataParts.join('\n    ')}
  </metadata>
  <content>
${escapeXml(chunkText)}
  </content>
</law_source>`

  // Full reference — all metadata for citations and document linking
  const fullMetadataParts = [
    createXmlTag('law_number', source.law_number),
    createXmlTag('article_number', source.article_number),
    createXmlTag('article_title', source.article_title),
    createXmlTag('document_title', source.document_title),
    createXmlTag('hierarchy_path', source.hierarchy_path),
    createXmlTag('legal_force_status', source.legal_force_status),
    createXmlTag('document_type', source.document_type),
    createXmlTag('fek_reference', source.fek_reference),
    createXmlTag('publication_date', source.publication_date),
    createXmlTag('amendment_type', source.amendment_type),
    createXmlTag('legal_effect', source.legal_effect),
    createXmlTag('issuing_authority', source.issuing_authority),
    arrayToXml('legal_domain', source.legal_domain),
    arrayToXml('keywords', source.keywords),
    arrayToXml('subject_areas', source.subject_areas),
    arrayToXml('semantic_tags_en', source.semantic_tags_en),
    arrayToXml('external_law_references', source.external_law_references),
    arrayToXml('amends_provisions', source.amends_provisions),
    arrayToXml('amended_by_provisions', source.amended_by_provisions),
    arrayToXml('entities_mentioned', source.entities_mentioned),
    arrayToXml('affected_entities', source.affected_entities),
    arrayToXml('content_flags', source.content_flags),
    createXmlTag('chunk_summary', source.chunk_summary),
    createXmlTag('file_url', source.file_url),
    createXmlTag('source_url', source.source_url),
    createXmlTag('chunk_index', source.chunk_index),
    createXmlTag('total_chunks', source.total_chunks),
  ].filter(Boolean)

  const fullReference = `<law_source>
  <metadata>
    ${fullMetadataParts.join('\n    ')}
  </metadata>
  <content>
${escapeXml(chunkText)}
  </content>
</law_source>`

  return {
    aiVersion,
    fullReference,
    referenceType: 'weaviate_law',
    lawNumber: source.law_number,
    articleNumber: source.article_number,
    legalDomain: source.legal_domain,
    score: source._additional?.score || source._additional?.distance,
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Hybrid search on GreekLegalDocuments (vector + BM25).
 * This is the primary law search function — use for most queries.
 */
export async function weaviateLawSearch(
  query: string,
  options: WeaviateLawSearchOptions = {}
): Promise<WeaviateLawResult[]> {
  if (!WEAVIATE_CONFIG.url) {
    console.error('❌ Weaviate legal URL not configured')
    return []
  }

  const collectionName = COLLECTIONS.LEGAL_DOCUMENTS
  console.log(`📚 Weaviate law search starting on ${collectionName} (hybrid, alpha=${options.alpha ?? 0.5})`)

  const embedding = await getQueryEmbedding(query)
  if (!embedding) {
    console.warn('⚠️ No embedding available, falling back to BM25-only search')
    try {
      const bm25Query = buildBm25Query(query, options)
      const data = await executeWeaviateQuery(bm25Query)
      const results = data?.Get?.[collectionName] || []
      console.log(`✅ Weaviate BM25 fallback: ${results.length} law results`)
      return results.map((hit: any) => processLawHit(hit))
    } catch (error) {
      console.error('❌ Weaviate BM25 fallback failed:', error)
      return []
    }
  }

  console.log(`📚 Got embedding (${embedding.length}d), querying Weaviate hybrid...`)

  try {
    const graphqlQuery = buildHybridQuery(query, embedding, options)
    const data = await executeWeaviateQuery(graphqlQuery)
    const results = data?.Get?.[collectionName] || []

    if (results.length === 0) {
      console.log('📚 Hybrid returned 0 results, trying vector-only...')
      const vectorQuery = buildVectorOnlyQuery(embedding, options)
      const vectorData = await executeWeaviateQuery(vectorQuery)
      const vectorResults = vectorData?.Get?.[collectionName] || []
      console.log(`✅ Weaviate vector fallback: ${vectorResults.length} law results`)
      return vectorResults.map((hit: any) => processLawHit(hit))
    }

    console.log(`✅ Weaviate hybrid: ${results.length} law results`)
    return results.map((hit: any) => processLawHit(hit))
  } catch (error) {
    console.error('❌ Weaviate law search error:', error)
    return []
  }
}

/**
 * Retrieves law data with character budget management.
 * Drop-in replacement for retrieveAndFilterData with 'greek_laws_collection'.
 */
export async function retrieveLawsFromWeaviate(
  query: string,
  maxCharacters: number,
  options: WeaviateLawSearchOptions = {}
): Promise<{ aiVersions: string[]; fullReferences: string[]; referenceTypes: string[] }> {
  try {
    const results = await weaviateLawSearch(query, { limit: 30, ...options })

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
        filtered.referenceTypes.push(result.referenceType)
        totalChars += result.aiVersion.length
      } else {
        const remaining = maxCharacters - totalChars
        if (remaining > 200) {
          filtered.aiVersions.push(result.aiVersion.substring(0, remaining - 3) + '...')
          filtered.fullReferences.push(result.fullReference)
          filtered.referenceTypes.push(result.referenceType)
        }
        break
      }
    }

    console.log(`✅ Weaviate law retrieval: ${filtered.aiVersions.length} documents (${totalChars} chars)`)
    return filtered
  } catch (error) {
    console.error('❌ Weaviate law retrieval failed:', error)
    return { aiVersions: [], fullReferences: [], referenceTypes: [] }
  }
}
