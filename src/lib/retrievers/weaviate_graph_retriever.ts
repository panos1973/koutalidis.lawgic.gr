// Weaviate Graph Retriever
// Searches the normalized knowledge graph collections:
// - Feb2026LawArticle: versioned articles with cross-references
// - Feb2026LawDocument: document metadata
// - Feb2026Amendment: amendment relationship edges
// Used for temporal queries, version history, and amendment chain tracking

import {
  COLLECTIONS,
  getQueryEmbedding,
  executeWeaviateQuery,
  escapeXml,
  createXmlTag,
  arrayToXml,
} from './weaviate_client'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ArticleVersion {
  chunkText: string
  chunkSummary: string
  articleNumber: string
  articleTitle: string
  version: number
  validFrom: string | null
  validTo: string | null
  isCurrent: boolean
  hierarchyPath: string
  legalDomain: string[]
  documentLawNumber: string
  documentFekReference: string
  documentTitle?: string
}

export interface AmendmentRecord {
  sourceLawNumber: string
  sourceArticleNumber: string
  targetLawNumber: string
  targetArticleNumber: string
  action: string
  scope: string
  changeDescription: string
  targetParagraph?: string
  targetCase?: string
  effectiveDate?: string
  confidence: number
}

export interface DocumentMetadata {
  fekReference: string
  lawNumber: string
  documentType: string
  title: string
  publicationDate?: string
  effectiveDate?: string
  legalForceStatus: string
  issuingAuthority?: string
  fekType: string
  fekYear?: number
  fekIssue?: number
  totalArticles?: number
}

// ─── Article Version Queries ────────────────────────────────────────────────

/**
 * Get the current version of a specific article.
 */
export async function getCurrentArticle(
  lawNumber: string,
  articleNumber: string
): Promise<ArticleVersion[]> {
  const query = `{
    Get {
      ${COLLECTIONS.LAW_ARTICLE}(
        where: {
          operator: And
          operands: [
            { path: ["document_law_number"], operator: Equal, valueText: "${lawNumber}" }
            { path: ["article_number"], operator: Equal, valueText: "${articleNumber}" }
            { path: ["is_current"], operator: Equal, valueBoolean: true }
          ]
        }
        limit: 10
      ) {
        chunk_text
        chunk_summary
        article_number
        article_title
        version
        valid_from
        valid_to
        is_current
        hierarchy_path
        legal_domain
        document_law_number
        document_fek_reference
        chunk_index
        total_chunks
        keywords
        content_flags
        external_law_references
        document {
          ... on ${COLLECTIONS.LAW_DOCUMENT} {
            title
            fek_reference
            legal_force_status
          }
        }
      }
    }
  }`

  try {
    const data = await executeWeaviateQuery(query)
    const results = data?.Get?.[COLLECTIONS.LAW_ARTICLE] || []
    return results.map(mapArticleResult)
  } catch (error) {
    console.error(`❌ Failed to get current article ${lawNumber} art.${articleNumber}:`, error)
    return []
  }
}

/**
 * Get all versions of a specific article (version history).
 */
export async function getArticleVersionHistory(
  lawNumber: string,
  articleNumber: string
): Promise<ArticleVersion[]> {
  const query = `{
    Get {
      ${COLLECTIONS.LAW_ARTICLE}(
        where: {
          operator: And
          operands: [
            { path: ["document_law_number"], operator: Equal, valueText: "${lawNumber}" }
            { path: ["article_number"], operator: Equal, valueText: "${articleNumber}" }
          ]
        }
        limit: 50
      ) {
        chunk_text
        chunk_summary
        article_number
        article_title
        version
        valid_from
        valid_to
        is_current
        hierarchy_path
        legal_domain
        document_law_number
        document_fek_reference
        chunk_index
        total_chunks
        document {
          ... on ${COLLECTIONS.LAW_DOCUMENT} {
            title
            fek_reference
          }
        }
      }
    }
  }`

  try {
    const data = await executeWeaviateQuery(query)
    const results = data?.Get?.[COLLECTIONS.LAW_ARTICLE] || []
    // Sort by version descending (newest first)
    return results
      .map(mapArticleResult)
      .sort((a: ArticleVersion, b: ArticleVersion) => b.version - a.version)
  } catch (error) {
    console.error(`❌ Failed to get version history for ${lawNumber} art.${articleNumber}:`, error)
    return []
  }
}

/**
 * Semantic search on Feb2026LawArticle (version-aware).
 * Filters to is_current=true by default.
 */
export async function searchArticlesGraph(
  searchQuery: string,
  options: {
    limit?: number
    currentOnly?: boolean
    lawNumber?: string
    legalDomain?: string[]
  } = {}
): Promise<ArticleVersion[]> {
  const embedding = await getQueryEmbedding(searchQuery)
  if (!embedding) return []

  const conditions: string[] = []

  if (options.currentOnly !== false) {
    conditions.push(`{ path: ["is_current"], operator: Equal, valueBoolean: true }`)
  }
  if (options.lawNumber) {
    conditions.push(`{ path: ["document_law_number"], operator: Equal, valueText: "${options.lawNumber}" }`)
  }
  if (options.legalDomain && options.legalDomain.length > 0) {
    conditions.push(`{ path: ["legal_domain"], operator: ContainsAny, valueText: ${JSON.stringify(options.legalDomain)} }`)
  }

  const whereClause = conditions.length > 0
    ? conditions.length === 1
      ? `where: ${conditions[0]}`
      : `where: { operator: And, operands: [${conditions.join(', ')}] }`
    : ''

  const limit = options.limit || 20

  const query = `{
    Get {
      ${COLLECTIONS.LAW_ARTICLE}(
        nearVector: {
          vector: [${embedding.join(',')}]
        }
        ${whereClause}
        limit: ${limit}
      ) {
        chunk_text
        chunk_summary
        article_number
        article_title
        version
        valid_from
        valid_to
        is_current
        hierarchy_path
        legal_domain
        document_law_number
        document_fek_reference
        chunk_index
        total_chunks
        keywords
        content_flags
        semantic_tags_en
        external_law_references
        document {
          ... on ${COLLECTIONS.LAW_DOCUMENT} {
            title
            fek_reference
            legal_force_status
          }
        }
        _additional { distance id }
      }
    }
  }`

  try {
    const data = await executeWeaviateQuery(query)
    const results = data?.Get?.[COLLECTIONS.LAW_ARTICLE] || []
    return results.map(mapArticleResult)
  } catch (error) {
    console.error('❌ Graph article search failed:', error)
    return []
  }
}

// ─── Amendment Queries ──────────────────────────────────────────────────────

/**
 * Find all amendments that target a specific law.
 * "What has been amended in law 4808/2021?"
 */
export async function getAmendmentsToLaw(
  targetLawNumber: string,
  targetArticleNumber?: string
): Promise<AmendmentRecord[]> {
  const conditions = [
    `{ path: ["target_law_number"], operator: Equal, valueText: "${targetLawNumber}" }`,
  ]
  if (targetArticleNumber) {
    conditions.push(
      `{ path: ["target_article_number"], operator: Equal, valueText: "${targetArticleNumber}" }`
    )
  }

  const whereClause = conditions.length === 1
    ? `where: ${conditions[0]}`
    : `where: { operator: And, operands: [${conditions.join(', ')}] }`

  const query = `{
    Get {
      ${COLLECTIONS.AMENDMENT}(
        ${whereClause}
        limit: 100
      ) {
        source_law_number
        source_article_number
        target_law_number
        target_article_number
        action
        scope
        change_description
        target_paragraph
        target_case
        target_subcase
        effective_date
        confidence
        extraction_method
      }
    }
  }`

  try {
    const data = await executeWeaviateQuery(query)
    const results = data?.Get?.[COLLECTIONS.AMENDMENT] || []
    return results.map(mapAmendmentResult)
  } catch (error) {
    console.error(`❌ Failed to get amendments to ${targetLawNumber}:`, error)
    return []
  }
}

/**
 * Find all amendments made BY a specific law.
 * "What did law 5090/2024 change?"
 */
export async function getAmendmentsByLaw(
  sourceLawNumber: string,
  sourceArticleNumber?: string
): Promise<AmendmentRecord[]> {
  const conditions = [
    `{ path: ["source_law_number"], operator: Equal, valueText: "${sourceLawNumber}" }`,
  ]
  if (sourceArticleNumber) {
    conditions.push(
      `{ path: ["source_article_number"], operator: Equal, valueText: "${sourceArticleNumber}" }`
    )
  }

  const whereClause = conditions.length === 1
    ? `where: ${conditions[0]}`
    : `where: { operator: And, operands: [${conditions.join(', ')}] }`

  const query = `{
    Get {
      ${COLLECTIONS.AMENDMENT}(
        ${whereClause}
        limit: 100
      ) {
        source_law_number
        source_article_number
        target_law_number
        target_article_number
        action
        scope
        change_description
        target_paragraph
        target_case
        target_subcase
        effective_date
        confidence
        extraction_method
      }
    }
  }`

  try {
    const data = await executeWeaviateQuery(query)
    const results = data?.Get?.[COLLECTIONS.AMENDMENT] || []
    return results.map(mapAmendmentResult)
  } catch (error) {
    console.error(`❌ Failed to get amendments by ${sourceLawNumber}:`, error)
    return []
  }
}

// ─── Document Metadata Queries ──────────────────────────────────────────────

/**
 * Get document-level metadata for a law.
 */
export async function getDocumentMetadata(
  lawNumber?: string,
  fekReference?: string
): Promise<DocumentMetadata[]> {
  let whereClause = ''
  if (lawNumber) {
    whereClause = `where: { path: ["law_number"], operator: Equal, valueText: "${lawNumber}" }`
  } else if (fekReference) {
    whereClause = `where: { path: ["fek_reference"], operator: Equal, valueText: "${fekReference}" }`
  }

  const query = `{
    Get {
      ${COLLECTIONS.LAW_DOCUMENT}(
        ${whereClause}
        limit: 10
      ) {
        fek_reference
        law_number
        document_type
        title
        publication_date
        effective_date
        legal_force_status
        issuing_authority
        fek_type
        fek_year
        fek_issue
        document_category
        total_articles
      }
    }
  }`

  try {
    const data = await executeWeaviateQuery(query)
    const results = data?.Get?.[COLLECTIONS.LAW_DOCUMENT] || []
    return results.map(mapDocumentResult)
  } catch (error) {
    console.error(`❌ Failed to get document metadata:`, error)
    return []
  }
}

// ─── Combined Graph Context ─────────────────────────────────────────────────

/**
 * Build rich graph context for a temporal/amendment query.
 * Combines: current article + version history + amendment records + document metadata.
 * Returns formatted XML for LLM consumption.
 */
export async function buildGraphContext(
  lawNumber: string,
  articleNumber?: string,
  maxCharacters: number = 50000
): Promise<string> {
  const parts: string[] = []
  let totalChars = 0

  // 1. Document metadata
  const docs = await getDocumentMetadata(lawNumber)
  if (docs.length > 0) {
    const doc = docs[0]
    const docXml = `<document_metadata>
  ${createXmlTag('law_number', doc.lawNumber)}
  ${createXmlTag('title', doc.title)}
  ${createXmlTag('document_type', doc.documentType)}
  ${createXmlTag('legal_force_status', doc.legalForceStatus)}
  ${createXmlTag('publication_date', doc.publicationDate)}
  ${createXmlTag('effective_date', doc.effectiveDate)}
  ${createXmlTag('issuing_authority', doc.issuingAuthority)}
  ${createXmlTag('total_articles', doc.totalArticles)}
  ${createXmlTag('fek_reference', doc.fekReference)}
</document_metadata>`
    parts.push(docXml)
    totalChars += docXml.length
  }

  // 2. Amendments to this law
  const amendments = articleNumber
    ? await getAmendmentsToLaw(lawNumber, articleNumber)
    : await getAmendmentsToLaw(lawNumber)

  if (amendments.length > 0) {
    const amendmentXml = `<amendments count="${amendments.length}">
${amendments.map(a => `  <amendment>
    ${createXmlTag('source', `${a.sourceLawNumber} art.${a.sourceArticleNumber}`)}
    ${createXmlTag('target', `art.${a.targetArticleNumber}${a.targetParagraph ? ' par.' + a.targetParagraph : ''}`)}
    ${createXmlTag('action', a.action)}
    ${createXmlTag('scope', a.scope)}
    ${createXmlTag('description', a.changeDescription)}
    ${createXmlTag('effective_date', a.effectiveDate)}
  </amendment>`).join('\n')}
</amendments>`
    if (totalChars + amendmentXml.length <= maxCharacters) {
      parts.push(amendmentXml)
      totalChars += amendmentXml.length
    }
  }

  // 3. Version history (if specific article requested)
  if (articleNumber) {
    const versions = await getArticleVersionHistory(lawNumber, articleNumber)
    if (versions.length > 0) {
      const versionXml = `<version_history article="${articleNumber}" versions="${versions.length}">
${versions.map(v => `  <version n="${v.version}" current="${v.isCurrent}">
    ${createXmlTag('valid_from', v.validFrom)}
    ${createXmlTag('valid_to', v.validTo)}
    ${createXmlTag('summary', v.chunkSummary)}
    ${v.isCurrent ? `<text>${escapeXml(v.chunkText)}</text>` : ''}
  </version>`).join('\n')}
</version_history>`
      if (totalChars + versionXml.length <= maxCharacters) {
        parts.push(versionXml)
        totalChars += versionXml.length
      }
    }
  }

  return parts.length > 0
    ? `<graph_context law="${lawNumber}">\n${parts.join('\n')}\n</graph_context>`
    : ''
}

/**
 * Build amendment context formatted as FilteredData (compatible with chat route).
 */
export async function retrieveGraphContext(
  lawNumber: string,
  articleNumber?: string,
  maxCharacters: number = 50000
): Promise<{ aiVersions: string[]; fullReferences: string[]; referenceTypes: string[] }> {
  const graphXml = await buildGraphContext(lawNumber, articleNumber, maxCharacters)

  if (!graphXml) {
    return { aiVersions: [], fullReferences: [], referenceTypes: [] }
  }

  return {
    aiVersions: [graphXml],
    fullReferences: [graphXml],
    referenceTypes: ['weaviate_graph'],
  }
}

// ─── Result Mappers ─────────────────────────────────────────────────────────

function mapArticleResult(hit: any): ArticleVersion {
  return {
    chunkText: hit.chunk_text || '',
    chunkSummary: hit.chunk_summary || '',
    articleNumber: hit.article_number || '',
    articleTitle: hit.article_title || '',
    version: hit.version || 1,
    validFrom: hit.valid_from || null,
    validTo: hit.valid_to || null,
    isCurrent: hit.is_current ?? true,
    hierarchyPath: hit.hierarchy_path || '',
    legalDomain: hit.legal_domain || [],
    documentLawNumber: hit.document_law_number || '',
    documentFekReference: hit.document_fek_reference || '',
    documentTitle: hit.document?.[0]?.title || undefined,
  }
}

function mapAmendmentResult(hit: any): AmendmentRecord {
  return {
    sourceLawNumber: hit.source_law_number || '',
    sourceArticleNumber: hit.source_article_number || '',
    targetLawNumber: hit.target_law_number || '',
    targetArticleNumber: hit.target_article_number || '',
    action: hit.action || '',
    scope: hit.scope || '',
    changeDescription: hit.change_description || '',
    targetParagraph: hit.target_paragraph || undefined,
    targetCase: hit.target_case || undefined,
    effectiveDate: hit.effective_date || undefined,
    confidence: hit.confidence ?? 0,
  }
}

function mapDocumentResult(hit: any): DocumentMetadata {
  return {
    fekReference: hit.fek_reference || '',
    lawNumber: hit.law_number || '',
    documentType: hit.document_type || '',
    title: hit.title || '',
    publicationDate: hit.publication_date || undefined,
    effectiveDate: hit.effective_date || undefined,
    legalForceStatus: hit.legal_force_status || '',
    issuingAuthority: hit.issuing_authority || undefined,
    fekType: hit.fek_type || '',
    fekYear: hit.fek_year || undefined,
    fekIssue: hit.fek_issue || undefined,
    totalArticles: hit.total_articles || undefined,
  }
}
