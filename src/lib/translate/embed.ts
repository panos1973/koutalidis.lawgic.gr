const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const MODEL = 'voyage-multilingual-2'

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY
  if (!key) {
    throw new Error('VOYAGE_API_KEY is missing in environment variables')
  }
  return key
}

interface VoyageEmbedResponse {
  data: Array<{ embedding: number[] }>
  usage: { total_tokens: number }
}

/**
 * Embeds one or more texts using Voyage AI's multilingual model.
 * Uses direct REST API calls to avoid ESM module resolution issues
 * with the voyageai SDK in Next.js.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  console.log(
    `[Embed] Calling Voyage AI (${MODEL}) with ${texts.length} text(s), ` +
      `total chars: ${texts.reduce((s, t) => s + t.length, 0)}`,
  )

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`[Embed] Voyage API error (${res.status}): ${errBody}`)
    throw new Error(`Voyage AI API error (${res.status}): ${errBody}`)
  }

  const json: VoyageEmbedResponse = await res.json()
  console.log(
    `[Embed] Success — ${json.data.length} embedding(s), ` +
      `${json.data[0]?.embedding?.length ?? 0} dims, ` +
      `${json.usage.total_tokens} tokens used`,
  )
  return json.data.map((item) => item.embedding)
}
