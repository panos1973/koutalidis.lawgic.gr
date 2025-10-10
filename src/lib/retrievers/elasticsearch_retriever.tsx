import { Client } from '@elastic/elasticsearch'
import { VoyageAIClient, VoyageAI } from 'voyageai'

// Create an Elasticsearch client
const client = new Client({
  cloud: { id: process.env.ELASTICSEARCH_CLOUD_ID! },
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
})

// 🎯 ENHANCED TYPES - Complete interface definitions with URL intelligence
type DocumentType = 'law_chunk' | 'court_complete' | 'unknown'

type PastCaseSourceType = {
  court?: string
  decision_number?: string
  decision_date?: string
  case_type?: string
  relevant_laws?: string
  related_law_provisions?: string
  primary_legal_basis?: string
  summary_ai_generated?: string
  court_level?: string
  judicial_reasoning_pro?: string
  judicial_reasoning_contra?: string
  legal_principles_established?: string
  chunk_text?: string
  full_text?: string
  pdf_url?: string
  document_id?: string
  parent_document_id?: string
  [key: string]: any
}

type GreekLawSourceType = {
  metadata?: {
    court?: string
    decision_number?: string
    date?: string
    case_type?: string
    main_laws?: string
    key_articles?: string
    primary_issue?: string
    monetary_amount?: string
    currency?: string
    important_dates?: string
    procedure_type?: string
    legal_field?: string
    outcome_type?: string
    court_level?: string
    File_Name?: string
    Page_URL?: string
    PDF_URL?: string
    pdf_url?: string
    PDF_URL_Saved_To?: string
    summary?: string
    chunk_id?: string
    document_id?: string
    parent_document_id?: string
    article_reference?: string
    chapter_info?: string
  }
  pageContent?: string
  full_text?: string
  fullText?: string
  chunk_id?: string
  document_id?: string
  summary?: string
}

type PreservedMetadata = {
  court?: string
  decision_number?: string
  date?: string
  case_type?: string
  main_laws?: string
  relevant_laws?: string
  key_articles?: string
  primary_issue?: string
  monetary_amount?: string
  currency?: string
  important_dates?: string
  procedure_type?: string
  legal_field?: string
  outcome_type?: string
  court_level?: string
  File_Name?: string
  summary?: string
  pdf_url?: string
  document_url?: string  // 🆕 Enhanced field
  document_type?: string  // 🆕 Enhanced field
  article_reference?: string  // 🆕 Enhanced field
  chunk_context?: string  // 🆕 Enhanced field
  complete_decision?: string  // 🆕 Enhanced field for court decisions
}

// Enhanced search options - keeping full compatibility
interface EnhancedSearchOptions {
  index?: string
  knn_k?: number
  knn_num_candidates?: number
  rrf_rank_window_size?: number
  rrf_rank_constant?: number
  model_name?: string
  debug_mode?: boolean
  // Keep all existing options for backward compatibility
  enable_recency_boost?: boolean
  recency_scale?: string
  recency_offset?: string
  recency_decay?: number
  enable_smart_law_detection?: boolean
  custom_law_boost?: number
  detected_laws?: string[]
  legal_categories?: string[]
  search_keywords?: string[]
  enable_dual_search?: boolean
  second_search_params?: {
    different_fields?: string[]
    different_boost?: number
  }
  experiment_mode?: 'original' | 'enhanced' | 'dual'
}

/**
 * 🚀 SMART DOCUMENT TYPE DETECTION
 * Intelligently determines if document should serve chunks (laws) or complete docs (courts)
 */
function detectDocumentType(index: string, source: any): DocumentType {
  // Court decisions → Complete document serving
  if (index === 'dev_greek_court') {
    return 'court_complete'
  }
  
  // Law collections → Chunk serving (specific articles)  
  if (index === 'greek_laws_collection') {
    return 'law_chunk'
  }
  
  // Fallback detection based on source content
  if (source.decision_number || source.court) {
    return 'court_complete'
  }
  
  if (source.metadata?.chunk_id || source.chunk_id || source.metadata?.main_laws) {
    return 'law_chunk'
  }
  
  return 'law_chunk'  // Default to law_chunk instead of unknown
}

/**
 * 🎯 INTELLIGENT URL GENERATION - CORRECTED for actual data structure
 * Uses the Elasticsearch _id for court decisions to work with route handler
 */
function generateDocumentURL(documentType: DocumentType, source: any): string {
  if (documentType === 'law_chunk') {
    // For laws: Use direct PDF URL if available
    if (source.metadata?.PDF_URL && source.metadata?.PDF_URL !== 'N/A') {
      return source.metadata.PDF_URL
    }
    
    // Use same fallback chain approach as court documents
    const docId = source._elasticsearch_id || source._id || source.document_id || 'unknown_chunk'
    return `/api/documents/law/${docId}`
  }
  
  if (documentType === 'court_complete') {
    // CRITICAL: Use Elasticsearch _id which is guaranteed to work with route handler
    // From your screenshots: _id, chunk_id, and document_id all have the same value
    // But _id is the canonical Elasticsearch identifier
    const docId = source._elasticsearch_id || source._id || source.document_id || 'unknown_document'
    
    console.log('Court document - Using Elasticsearch ID for HTML:', docId)
    console.log('Court document - chunk_text length:', source.chunk_text ? source.chunk_text.length : 0)
    
    return `/api/documents/court/${docId}`
  }
  
  // Fallback for any other document type
  const docId = source._elasticsearch_id || source._id || source.document_id || 'unknown_document'
  return `/api/documents/law/${docId}`
}

/**
 * 📝 ENHANCED ARTICLE REFERENCE EXTRACTION
 * Intelligently extracts article/section information from law chunks
 */
function extractArticleReference(source: any, contentField: string): string {
  // Check metadata first
  if (source.metadata?.key_articles) {
    return source.metadata.key_articles
  }
  
  // Extract from content using Greek legal patterns
  const articlePatterns = [
    /Άρθρο\s+(\d+[α-ωΑ-Ω]*)/gi,
    /ΑΡΘΡΟ\s+(\d+[α-ωΑ-Ω]*)/gi,
    /άρθρο\s+(\d+[α-ωΑ-Ω]*)/gi,
    /Παράγραφος\s+(\d+[α-ωΑ-Ω]*)/gi,
    /παράγραφος\s+(\d+[α-ωΑ-Ω]*)/gi
  ]
  
  for (const pattern of articlePatterns) {
    const match = contentField.match(pattern)
    if (match) {
      return match[0] // Return the full match (e.g., "Άρθρο 15")
    }
  }
  
  return 'Σχετική διάταξη' // Default fallback
}

/**
 * 📚 CHAPTER/SECTION CONTEXT EXTRACTION
 * Extracts chapter or section context for better user orientation
 */
function extractChunkContext(source: any, contentField: string): string {
  // Check metadata first for legal field
  if (source.metadata?.legal_field) {
    return source.metadata.legal_field
  }
  
  // Extract chapter/section information from content
  const chapterPatterns = [
    /ΚΕΦΑΛΑΙΟ\s+[ΙVXLC]+[^\n]*/gi,
    /Κεφάλαιο\s+[ΙVXLC]+[^\n]*/gi,
    /ΜΕΡΟΣ\s+[ΙVXLC]+[^\n]*/gi,
    /Μέρος\s+[ΙVXLC]+[^\n]*/gi,
    /ΤΜΗΜΑ\s+[ΙVXLC]+[^\n]*/gi,
    /Τμήμα\s+[ΙVXLC]+[^\n]*/gi
  ]
  
  for (const pattern of chapterPatterns) {
    const match = contentField.match(pattern)
    if (match) {
      return match[0].trim()
    }
  }
  
  return 'Νομοθετικό κείμενο' // Default fallback
}

/**
 * 🛡️ XML SAFETY - Escapes XML special characters
 */
function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    unsafe = String(unsafe)
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 🏷️ SMART XML TAG CREATION
 */
function createXmlTag(
  name: string,
  content: string | number | null | undefined
): string {
  if (content === null || content === undefined || content === '') return ''
  if (content === 'null' || content === 'undefined') return ''
  
  const safeName = name.replace(/[\s\[\]']/g, '_').toLowerCase()
  const safeContent = escapeXml(String(content))
  return `<${safeName}>${safeContent}</${safeName}>`
}

/**
 * 🎛️ INTELLIGENT METADATA FILTERING - CORRECTED for actual data structure
 * Court decisions: fields at ROOT level (not under metadata)
 * Laws: fields under metadata object
 */
function filterMetadataForAI(source: any, index: string, documentType: DocumentType, documentUrl: string): PreservedMetadata {
  const result: PreservedMetadata = {
    document_url: documentUrl,  // Always include document URL
    document_type: documentType  // Always include document type
  }
  
  if (index === 'dev_greek_court') {
    // CRITICAL: For dev_greek_court, fields are at ROOT level (confirmed from screenshots)
    const preservedFields = [
      'court',
      'court_name',        // Added based on screenshots
      'decision_number', 
      'decision_date',
      'case_type',
      'relevant_laws',
      'court_level',
      'court_location',    // Added based on screenshots
      'summary_ai_generated',
      'pdf_url',
    ]
    
    preservedFields.forEach((field) => {
      if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
        ;(result as any)[field] = source[field]
      }
    })
  } else {
    // For greek_laws_collection, fields are under metadata.*
    const preservedFields = [
      'case_type',        // Using as title field
      'main_laws',        // Referenced laws
      'key_articles',     // Specific articles
      'legal_field',      // Legal domain
      'date',             // Relevant date
      'PDF_URL',          // Document access
      'decision_number',  // Reference number
      'court',            // Issuing authority
      'outcome_type',     // Decision result
      'summary'           // AI summary
    ]
    
    preservedFields.forEach((field) => {
      const value = source.metadata?.[field]
      if (value !== undefined && value !== null && value !== '' && value !== 'N/A') {
        ;(result as any)[field] = value
      }
    })
  }

  return result
}

/**
 * 🎯 SMART COURT DECISION PROCESSING - CORRECTED for chunk_text priority
 * Processes court decisions using chunk_text as primary content source
 */
function processPastCaseHit(source: any, debug_mode: boolean = false): { aiVersion: string; fullReference: string } {
  const documentType = 'court_complete'
  const documentUrl = generateDocumentURL(documentType, source)
  
  // CORRECTED: chunk_text is PRIMARY for court decisions based on screenshots
  // This aligns with route handler expectations: chunk_text -> full_text -> summary_ai_generated
  const contentField = source.chunk_text || 
                       source.full_text || 
                       source.summary_ai_generated || 
                       'No content available.'
  
  // Filter metadata for AI processing with enhanced fields
  const preservedMetadata = filterMetadataForAI(source, 'dev_greek_court', documentType, documentUrl)
  preservedMetadata.complete_decision = 'true'
  preservedMetadata.document_url = documentUrl
  
  // Create AI version with essential metadata only
  const aiMetadata = Object.entries(preservedMetadata)
    .map(([key, value]) => createXmlTag(key, value))
    .filter(Boolean)
    .join('\n    ')

  const aiVersion = `<court_source>
    <metadata>
      ${aiMetadata}
    </metadata>
</court_source>`

  // Create full reference with all available metadata + URL
  // CORRECTED: Exclude chunk_text from metadata display since it's shown in content
  const allMetadata = Object.entries(source)
    .filter(([key]) => !['embedding', 'chunk_text', 'full_text', '_elasticsearch_id'].includes(key))
    .map(([key, value]: [string, any]) => createXmlTag(key, value))
    .filter(Boolean)
    .join('\n      ')

  const enhancedMetadata = `${allMetadata}
      ${createXmlTag('document_url', documentUrl)}
      ${createXmlTag('document_type', documentType)}`

  const fullReference = `<court_source>
    <metadata>
      ${enhancedMetadata}
    </metadata>
    <content>
${escapeXml(contentField)}
    </content>
</court_source>`

  if (debug_mode) {
    console.log('Court decision processed:', {
      elasticsearch_id: source._elasticsearch_id,
      court: source.court || source.court_name,
      decision_number: source.decision_number,
      document_url: documentUrl,
      chunk_text_available: !!source.chunk_text,
      chunk_text_length: source.chunk_text ? source.chunk_text.length : 0,
      content_source: source.chunk_text ? 'chunk_text' : source.full_text ? 'full_text' : 'summary_ai_generated'
    })
  }

  return { aiVersion, fullReference }
}

/**
 * ⚖️ SMART LAW DOCUMENT PROCESSING - CORRECTED for metadata structure
 * Processes law documents for chunk-specific serving
 */
function processLawHit(source: any, debug_mode: boolean = false): { aiVersion: string; fullReference: string } {
  const documentType = 'law_chunk'
  const documentUrl = generateDocumentURL(documentType, source)
  
  // Priority: summary (AI-generated), then other content fields
  const contentField = source.summary || 
                       source.metadata?.summary ||
                       source.pageContent || 
                       source.full_text || 
                       source.fullText || 
                       'No content available.'
  
  const articleRef = extractArticleReference(source, contentField)
  const chunkContext = extractChunkContext(source, contentField)
  
  const preservedMetadata = filterMetadataForAI(source, 'greek_laws_collection', documentType, documentUrl)
  
  preservedMetadata.article_reference = articleRef
  preservedMetadata.chunk_context = chunkContext
  preservedMetadata.document_url = documentUrl
  
  const aiMetadata = Object.entries(preservedMetadata)
    .map(([key, value]) => createXmlTag(key, value))
    .filter(Boolean)
    .join('\n    ')

  const aiVersion = `<law_source>
    <metadata>
      ${aiMetadata}
    </metadata>
</law_source>`

  // Create full reference using metadata fields
  const metadataEntries = source.metadata ? Object.entries(source.metadata) : []
  const allMetadata = metadataEntries
    .filter(([key, value]) => value && value !== 'N/A' && !['embedding'].includes(key))
    .map(([key, value]: [string, any]) => createXmlTag(`metadata_${key}`, value))
    .filter(Boolean)
    .join('\n      ')

  // Add enhanced metadata with URLs and context
  const enhancedMetadata = `${allMetadata}
      ${createXmlTag('document_url', documentUrl)}
      ${createXmlTag('document_type', documentType)}
      ${createXmlTag('article_reference', articleRef)}
      ${createXmlTag('chunk_context', chunkContext)}`

  const fullReference = `<law_source>
    <metadata>
      ${enhancedMetadata}
    </metadata>
    <content>
${escapeXml(contentField)}
    </content>
</law_source>`

  if (debug_mode) {
    console.log('Law document processed:', {
      elasticsearch_id: source._elasticsearch_id,
      case_type: source.metadata?.case_type,
      legal_field: source.metadata?.legal_field,
      document_url: documentUrl
    })
  }

  return { aiVersion, fullReference }
}

/**
 * 🔄 SMART HIT PROCESSING ROUTER
 * Routes different document types to appropriate processors
 */
function processSearchHits(hits: any[], index: string, debug_mode: boolean = false): { aiVersion: string; fullReference: string }[] {
  if (hits.length === 0) {
    return []
  }

  return hits.map((hit: any) => {
    // Add the Elasticsearch _id to the source object
    hit._source._elasticsearch_id = hit._id
    
    const documentType = detectDocumentType(index, hit._source)

    if (documentType === 'court_complete') {
      return processPastCaseHit(hit._source, debug_mode)
    } else {
      return processLawHit(hit._source, debug_mode)
    }
  })
}

/**
 * 🚀 MAIN ELASTICSEARCH RETRIEVER - ENHANCED WITH VOYAGEAI 3.5
 * Returns exactly what your existing system expects: { aiVersion: string; fullReference: string }[]
 * Uses your proven working RRF structure with VoyageAI 3.5 and corrected metadata handling
 */
export async function elasticsearchRetrieverHybridSearch(
  searchQuery: string,
  options: EnhancedSearchOptions = {}
): Promise<{ aiVersion: string; fullReference: string }[]> {
  const {
    index = 'collection_law_embeddings',
    model_name = 'voyage-3.5',
    knn_k = 50,
    knn_num_candidates = 100,
    rrf_rank_window_size = 50,
    rrf_rank_constant = 20,
    debug_mode = false,
  } = options

  if (debug_mode) {
    console.log('Elasticsearch Search initiated for index:', index)
    console.log('Using VoyageAI 3.5 for embeddings')
  }

  // Generate embedding with VoyageAI 3.5 - with single retry
  let vectorQuery: number[] | undefined
  try {
    const voyageClient = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY!,
    })
    
    const response = await voyageClient.embed({
      model: model_name,
      input: searchQuery,
      inputType: 'query',
    })
    vectorQuery = response?.data?.[0]?.embedding
    
    if (!vectorQuery || vectorQuery.length === 0) {
      throw new Error('Empty embedding returned')
    }
  } catch (error) {
    console.warn('VoyageAI embedding failed, retrying once:', error)
    
    // Single retry attempt
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Brief delay
      const voyageClient = new VoyageAIClient({
        apiKey: process.env.VOYAGE_API_KEY!,
      })
      
      const response = await voyageClient.embed({
        model: model_name,
        input: searchQuery,
        inputType: 'query',
      })
      vectorQuery = response?.data?.[0]?.embedding
      
      if (!vectorQuery || vectorQuery.length === 0) {
        throw new Error('Empty embedding returned on retry')
      }
    } catch (retryError) {
      console.warn('VoyageAI retry failed, proceeding with BM25 only:', retryError)
      vectorQuery = undefined
    }
  }

  // Smart field mapping based on index type
  const getSearchField = (index: string): string => {
    if (index === 'dev_greek_court' || index.includes('court')) {
      // CORRECTED: Use chunk_text for court decisions search (based on your data structure)
      return 'chunk_text'
    }
    return 'pageContent'
  }

  const searchField = getSearchField(index)

  try {
    // Build retrievers array using your proven working structure
    const retrievers: any[] = []

    // 1. BM25 retriever
    retrievers.push({
      standard: {
        query: {
          match: {
            [searchField]: {
              query: searchQuery,
              operator: 'or'
            }
          }
        }
      }
    })

    // 2. Add semantic search if embedding is available
    if (vectorQuery && vectorQuery.length > 0) {
      retrievers.push({
        knn: {
          field: 'embedding',
          query_vector: vectorQuery,
          k: knn_k,
          num_candidates: knn_num_candidates,
        }
      })
    }

    if (debug_mode) {
      console.log(`Using ${retrievers.length} retrievers: BM25 ${vectorQuery ? '+ Semantic' : 'only'}`)
      console.log('Search field for', index, ':', searchField)
    }

    // RRF search using your proven working structure
    const response = await client.search({
      index: index,
      retriever: {
        rrf: {
          retrievers,
          rank_window_size: rrf_rank_window_size,
          rank_constant: rrf_rank_constant,
        },
      },
      _source: index === 'dev_greek_court' ? ['*'] : ['metadata.*', 'pageContent', 'full_text', 'fullText', 'summary', '_id'],
      size: rrf_rank_window_size,
    })

    const hits = response.hits.hits
    if (hits.length === 0) {
      if (debug_mode) console.log('No RRF results found')
      return []
    }

    if (debug_mode) {
      console.log(`Search successful: ${hits.length} results`)
      if (index === 'dev_greek_court' && hits.length > 0) {
        const firstHit = hits[0]._source as any
        console.log('First court hit has chunk_text:', !!firstHit.chunk_text)
        console.log('First court hit chunk_text length:', firstHit.chunk_text ? firstHit.chunk_text.length : 0)
      }
    }

    // Process with enhanced intelligence
    const processedResults = processSearchHits(hits, index, debug_mode)
    
    if (debug_mode) {
      console.log('Processing complete:', {
        totalResults: processedResults.length,
        lawChunks: processedResults.filter(r => r.aiVersion.includes('law_source')).length,
        courtDecisions: processedResults.filter(r => r.aiVersion.includes('court_source')).length
      })
    }

    return processedResults

  } catch (rrfError) {
    console.warn('RRF search failed, using BM25 fallback:', rrfError)
    
    // BM25 fallback
    try {
      const fallbackResponse = await client.search({
        index: index,
        query: {
          match: {
            [searchField]: {
              query: searchQuery,
              operator: 'or'
            }
          }
        },
        _source: index === 'dev_greek_court' ? ['*'] : ['metadata.*', 'pageContent', 'full_text', 'fullText', 'summary', '_id'],
        size: rrf_rank_window_size,
      })

      if (debug_mode) {
        console.log(`Fallback successful: ${fallbackResponse.hits.hits.length} results`)
      }

      return processSearchHits(fallbackResponse.hits.hits, index, debug_mode)

    } catch (fallbackError) {
      console.error('Complete search failure:', fallbackError)
      return []
    }
  }
}

// Export helper functions for potential future use
export { 
  escapeXml, 
  createXmlTag, 
  filterMetadataForAI, 
  detectDocumentType, 
  generateDocumentURL,
  extractArticleReference,
  extractChunkContext
}
