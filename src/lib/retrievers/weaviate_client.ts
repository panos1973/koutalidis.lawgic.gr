// Shared Weaviate client configuration for the primary legal knowledge graph
// Cluster: dxyeak9tnm4gp8raeh1g (europe-west3, GCP)
// All vectors: voyage-context-3 (1024 dimensions)

import { VoyageAIClient } from 'voyageai'

// ─── Environment Configuration ──────────────────────────────────────────────

export const WEAVIATE_CONFIG = {
  url: process.env.WEAVIATE_URL_LEGAL || 'dxyeak9tnm4gp8raeh1g.c0.europe-west3.gcp.weaviate.cloud',
  apiKey: process.env.WEAVIATE_API_KEY_LEGAL || '',
  voyageModel: 'voyage-context-3',
  voyageApiKey: process.env.VOYAGE_API_KEY || '',
  dimensions: 1024,
} as const

// ─── Collection Names ───────────────────────────────────────────────────────

export const COLLECTIONS = {
  /** Primary flat law search — 412K chunks, hybrid search */
  LEGAL_DOCUMENTS: 'GreekLegalDocuments',
  /** Document metadata (no vectors) — 45K documents */
  LAW_DOCUMENT: 'Feb2026LawDocument',
  /** Article-level graph node (with vectors) — 408K chunks */
  LAW_ARTICLE: 'Feb2026LawArticle',
  /** Amendment relationship edges — 5.3K records */
  AMENDMENT: 'Feb2026Amendment',
  /** Delegation edges (schema only, not yet populated) */
  DELEGATION: 'Feb2026Delegation',
  /** Court decisions — schema ready */
  COURT_CONTEXT: 'GreekCourtContext',
} as const

// ─── Embedding Helper ───────────────────────────────────────────────────────

let voyageClient: VoyageAIClient | null = null

function getVoyageClient(): VoyageAIClient | null {
  if (!WEAVIATE_CONFIG.voyageApiKey) {
    console.error('❌ VOYAGE_API_KEY not set for Weaviate retrievers')
    return null
  }
  if (!voyageClient) {
    voyageClient = new VoyageAIClient({ apiKey: WEAVIATE_CONFIG.voyageApiKey })
  }
  return voyageClient
}

export async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const client = getVoyageClient()
  if (!client) return null

  try {
    const response = await client.embed({
      model: WEAVIATE_CONFIG.voyageModel,
      input: query,
      inputType: 'query',
    })

    const embedding = response?.data?.[0]?.embedding
    if (!embedding || embedding.length === 0) {
      throw new Error('Empty embedding returned from voyage-context-3')
    }

    return embedding
  } catch (error) {
    console.error('❌ Voyage embedding failed:', error)
    return null
  }
}

// ─── GraphQL Executor ───────────────────────────────────────────────────────

export async function executeWeaviateQuery(graphqlQuery: string): Promise<any> {
  const endpoint = WEAVIATE_CONFIG.url.startsWith('http')
    ? WEAVIATE_CONFIG.url
    : `https://${WEAVIATE_CONFIG.url}`

  // 15-second timeout to prevent hanging if Weaviate is unreachable
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  let response: Response
  try {
    response = await fetch(`${endpoint}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WEAVIATE_CONFIG.apiKey}`,
      },
      body: JSON.stringify({ query: graphqlQuery }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Weaviate API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()

  if (data.errors && data.errors.length > 0) {
    throw new Error(`Weaviate GraphQL errors: ${JSON.stringify(data.errors)}`)
  }

  return data.data
}

// ─── XML Helpers (shared across retrievers) ─────────────────────────────────

export function escapeXml(unsafe: string): string {
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

export function createXmlTag(name: string, content: string | number | null | undefined): string {
  if (content === null || content === undefined || content === '') return ''
  if (content === 'null' || content === 'undefined') return ''
  const safeName = name.replace(/[\s\[\]']/g, '_').toLowerCase()
  const safeContent = escapeXml(String(content))
  return `<${safeName}>${safeContent}</${safeName}>`
}

export function arrayToXml(name: string, items: string[] | null | undefined): string {
  if (!items || items.length === 0) return ''
  const safeName = name.replace(/[\s\[\]']/g, '_').toLowerCase()
  return `<${safeName}>${items.map(item => escapeXml(item)).join(', ')}</${safeName}>`
}
