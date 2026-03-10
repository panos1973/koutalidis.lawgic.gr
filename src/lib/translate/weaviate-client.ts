/**
 * Weaviate Translation Memory client.
 *
 * Uses the REST API directly (same pattern as weaviate_court_retriever.ts)
 * to avoid adding `weaviate-client` as a new dependency.
 */

export type LangCode = 'el' | 'en' | 'fr'

const WEAVIATE_URL = process.env.WEAVIATE_URL_TRANSLATE
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY_TRANSLATE

/**
 * Weaviate collection names for translation memory.
 * Language pairs are stored in alphabetical order.
 */
const COLLECTIONS: Record<string, string> = {
  tm_el_en: 'Tm_el_en',
  tm_el_fr: 'Tm_el_fr',
  tm_en_fr: 'Tm_en_fr',
}

/** Returns alphabetically-sorted pair key */
function pairKey(a: LangCode, b: LangCode): string {
  return [a, b].sort().join('_')
}

/**
 * Returns the Weaviate collection name for a given source→target pair.
 */
export function getCollectionForPair(
  src: LangCode,
  tgt: LangCode,
): string | null {
  const key = `tm_${pairKey(src, tgt)}`
  return COLLECTIONS[key] ?? null
}

export interface WeaviateNearVectorResult {
  textSrc: string
  textTgt: string
  langSrc: string
  langTgt: string
  sourceCorpus: string
  distance: number
}

/**
 * Queries Weaviate TM collection using nearVector search via REST API.
 * Returns up to `limit` results per query.
 */
export async function queryWeaviateNearVector(
  vector: number[],
  collectionName: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  limit: number,
): Promise<WeaviateNearVectorResult[]> {
  if (!WEAVIATE_URL || !WEAVIATE_API_KEY) {
    console.warn('[Weaviate TM] WEAVIATE_URL_TRANSLATE or WEAVIATE_API_KEY_TRANSLATE not configured — skipping')
    return []
  }

  // Use Weaviate GraphQL endpoint
  const graphqlUrl = `https://${WEAVIATE_URL}/v1/graphql`

  const query = `{
    Get {
      ${collectionName}(
        nearVector: { vector: ${JSON.stringify(vector)} }
        limit: ${limit}
      ) {
        text_src
        text_tgt
        lang_src
        lang_tgt
        source_corpus
        _additional {
          distance
        }
      }
    }
  }`

  const res = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WEAVIATE_API_KEY}`,
    },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`[Weaviate TM] Query error (${res.status}): ${errBody}`)
    return []
  }

  const json = await res.json()
  const results = json?.data?.Get?.[collectionName] ?? []

  return results.map((obj: Record<string, unknown>) => ({
    textSrc: String(obj.text_src ?? ''),
    textTgt: String(obj.text_tgt ?? ''),
    langSrc: String(obj.lang_src ?? sourceLang),
    langTgt: String(obj.lang_tgt ?? targetLang),
    sourceCorpus: String(obj.source_corpus ?? ''),
    distance:
      (obj._additional as Record<string, unknown>)?.distance != null
        ? Number((obj._additional as Record<string, unknown>).distance)
        : 1,
  }))
}
