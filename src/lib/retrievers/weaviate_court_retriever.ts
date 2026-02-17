// Weaviate Court Decision Retriever
// Retrieves Greek court decisions from Weaviate vector database
// Uses VoyageAI (voyage-context-3) for embeddings and Weaviate nearVector search

import { VoyageAIClient } from 'voyageai'

// Configuration from environment variables with hardcoded fallbacks
const WEAVIATE_URL = process.env.WEAVIATE_URL_LAWNCOURT || 'lqtwyfnvr6cm2wskqhv1a.c0.europe-west3.gcp.weaviate.cloud'
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY_LAWNCOURT || 'Uko3WUx2ZkZZeWs4cWJBUl9qTWN6bE8xQUE0NUhkejE4aVE3TUV6QnE0bWtXWGd0dWd3MWtFaHZLNTRjPV92MjAw'
const COLLECTION_NAME = process.env.WEAVIATE_COLLECTION_COURT || 'Test_GreekCourtDecision'
const VOYAGE_MODEL = 'voyage-multilingual-2'
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY

interface WeaviateCourtResult {
  aiVersion: string
  fullReference: string
}

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

function createXmlTag(name: string, content: string | number | null | undefined): string {
  if (content === null || content === undefined || content === '') return ''
  if (content === 'null' || content === 'undefined') return ''
  const safeName = name.replace(/[\s\[\]']/g, '_').toLowerCase()
  const safeContent = escapeXml(String(content))
  return `<${safeName}>${safeContent}</${safeName}>`
}

async function getVoyageEmbedding(query: string): Promise<number[] | null> {
  if (!VOYAGE_API_KEY) {
    console.error('❌ VOYAGE_API_KEY not set for Weaviate court retriever')
    return null
  }

  try {
    const voyageClient = new VoyageAIClient({
      apiKey: VOYAGE_API_KEY,
    })

    const response = await voyageClient.embed({
      model: VOYAGE_MODEL,
      input: query,
      inputType: 'query',
    })

    const embedding = response?.data?.[0]?.embedding
    if (!embedding || embedding.length === 0) {
      throw new Error('Empty embedding returned')
    }

    return embedding
  } catch (error) {
    console.error('❌ Voyage embedding failed for Weaviate court retriever:', error)
    return null
  }
}

function processWeaviateCourtHit(source: any): WeaviateCourtResult {
  const contentField =
    source.chunk_text ||
    source.full_text ||
    source.summary_ai_generated ||
    source.content ||
    'No content available.'

  // Build metadata tags for AI version
  const metadataFields = [
    'court', 'court_name', 'decision_number', 'decision_date',
    'case_type', 'relevant_laws', 'court_level', 'court_location',
    'summary_ai_generated', 'pdf_url', 'related_law_provisions',
    'primary_legal_basis', 'legal_principles_established',
    'judicial_reasoning_pro', 'judicial_reasoning_contra',
  ]

  const aiMetadataParts: string[] = []
  const fullMetadataParts: string[] = []

  // AI version - essential metadata only
  const aiEssentialFields = [
    'court', 'court_name', 'decision_number', 'decision_date',
    'case_type', 'relevant_laws', 'court_level', 'summary_ai_generated', 'pdf_url',
  ]

  for (const field of aiEssentialFields) {
    const value = source[field]
    if (value !== undefined && value !== null && value !== '' && value !== 'N/A') {
      aiMetadataParts.push(createXmlTag(field, value))
    }
  }

  // Full reference - all available metadata
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

export async function weaviateCourtSearch(
  query: string,
  maxResults: number = 20
): Promise<WeaviateCourtResult[]> {
  if (!WEAVIATE_URL) {
    console.error('❌ Weaviate URL not configured')
    return []
  }

  console.log(`📚 Weaviate court search starting for collection: ${COLLECTION_NAME}`)
  console.log(`📚 Weaviate URL: ${WEAVIATE_URL}`)

  // Get embedding for the query
  const embedding = await getVoyageEmbedding(query)
  if (!embedding) {
    console.warn('⚠️ No embedding available, cannot perform Weaviate vector search')
    return []
  }

  console.log(`📚 Got embedding (${embedding.length} dimensions), querying Weaviate...`)

  // Build GraphQL query for Weaviate
  const graphqlQuery = {
    query: `{
      Get {
        ${COLLECTION_NAME}(
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
    const weaviateEndpoint = WEAVIATE_URL.startsWith('http')
      ? WEAVIATE_URL
      : `https://${WEAVIATE_URL}`

    const response = await fetch(`${weaviateEndpoint}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WEAVIATE_API_KEY}`,
      },
      body: JSON.stringify(graphqlQuery),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Weaviate API error: ${response.status} - ${errorText}`)
      return []
    }

    const data = await response.json()

    if (data.errors && data.errors.length > 0) {
      console.error('❌ Weaviate GraphQL errors:', JSON.stringify(data.errors))
      return []
    }

    const results = data?.data?.Get?.[COLLECTION_NAME]
    if (!results || results.length === 0) {
      console.log('📚 No Weaviate court results found')
      return []
    }

    console.log(`✅ Weaviate returned ${results.length} court decisions`)

    // Process results into the standard format
    const processedResults = results.map((hit: any) => {
      const { _additional, ...source } = hit
      return processWeaviateCourtHit(source)
    })

    return processedResults
  } catch (error) {
    console.error('❌ Weaviate court search error:', error)
    return []
  }
}

export async function retrieveCourtDecisionsFromWeaviate(
  query: string,
  maxCharacters: number
): Promise<{ aiVersions: string[]; fullReferences: string[]; referenceTypes: string[] }> {
  try {
    const results = await weaviateCourtSearch(query)

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
