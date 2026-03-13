// src/lib/legalSearchPipeline.ts
// Shared legal search pipeline used by all tools (case analysis, contract comparison,
// document creation, case study). Provides query analysis, parallel database + internet
// search, VoyageAI reranking with court decision guarantee.

import { weaviateLawSearch } from '@/lib/retrievers/weaviate_law_retriever'
import { weaviateCourtSearch } from '@/lib/retrievers/weaviate_court_retriever'
import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { decodeEscapedString } from '@/lib/decoding'
import { analyzeQuery } from '@/lib/queryAnalyzer'
import { searchInternetForLegal } from '@/lib/internetSearchUtils'
import { searchYouComForLegal } from '@/lib/youComSearchUtils'
import { VoyageAIClient, VoyageAI } from 'voyageai'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LegalSearchOptions {
  /** Include Greek law search */
  includeGreekLaws: boolean
  /** Include Greek court decision search */
  includeGreekCourtDecisions: boolean
  /** Max characters for law results (default: 15000) */
  maxLawCharacters?: number
  /** Max characters for court results (default: 15000) */
  maxCourtCharacters?: number
  /** Number of top results after reranking (default: 8) */
  rerankedK?: number
  /** Conversation messages for query analysis context */
  conversationMessages?: any[]
  /** Locale for query analysis */
  locale?: string
}

export interface LegalSearchResult {
  /** All results after reranking (laws + courts + internet) */
  rerankedResults: string[]
  /** Law results only (before reranking) */
  lawResults: string[]
  /** Court results only (before reranking) */
  courtResults: string[]
  /** Internet results only (before reranking) */
  internetResults: string[]
  /** Query analysis metadata */
  queryAnalysis?: {
    legalField?: string
    detectedDomain?: string
    vectorDbQuery: string
  }
}

// ─── Elasticsearch Fallback ─────────────────────────────────────────────────

async function retrieveFromElasticsearch(
  query: string,
  index: string,
  maxCharacters: number,
  model_name?: string
): Promise<string[]> {
  try {
    const retrieved_data = await elasticsearchRetrieverHybridSearch(query, {
      knn_k: 20,
      knn_num_candidates: 60,
      rrf_rank_window_size: 15,
      rrf_rank_constant: 20,
      index,
      model_name,
    })

    const decoded_data = retrieved_data.map(
      (doc: { aiVersion: string; fullReference: string }) =>
        decodeEscapedString(doc.fullReference)
    )

    let totalChars = 0
    const filtered: string[] = []
    for (const doc of decoded_data) {
      if (totalChars + doc.length <= maxCharacters) {
        filtered.push(doc)
        totalChars += doc.length
      } else break
    }
    return filtered
  } catch (error) {
    console.error('Elasticsearch retrieval error:', error)
    return []
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Unified legal search pipeline used by all tools.
 * 1. Analyzes query with Gemini/Claude for adapted search queries
 * 2. Runs database + internet searches in parallel
 * 3. Applies VoyageAI reranking with court decision guarantee
 */
export async function runLegalSearchPipeline(
  userQuery: string,
  options: LegalSearchOptions
): Promise<LegalSearchResult> {
  const {
    includeGreekLaws,
    includeGreekCourtDecisions,
    maxLawCharacters = 15_000,
    maxCourtCharacters = 15_000,
    rerankedK = 8,
    conversationMessages = [],
    locale = 'el',
  } = options

  const needsSearch = includeGreekLaws || includeGreekCourtDecisions

  if (!needsSearch) {
    return {
      rerankedResults: [],
      lawResults: [],
      courtResults: [],
      internetResults: [],
    }
  }

  // Step 1: Query analysis (fast, non-blocking)
  let enhanced: any = null
  try {
    const analysis = await analyzeQuery(userQuery, conversationMessages.slice(-6) as any, locale)
    enhanced = analysis?.enhanced
    if (enhanced) {
      console.log(`Query Analysis: field=${enhanced.legalField}, domain=${enhanced.detectedDomain}`)
    }
  } catch (e) {
    console.warn('Query analysis failed, using raw query:', e)
  }

  const vectorDbQuery = enhanced?.adaptedQueries?.vectorDb || userQuery
  const perplexityQuery = enhanced?.adaptedQueries?.perplexity || userQuery
  const youcomQuery = enhanced?.adaptedQueries?.youcom || userQuery

  // Step 2: Parallel searches
  let lawResults: string[] = []
  let courtResults: string[] = []
  let internetResults: string[] = []

  const searchPromises: Promise<void>[] = []

  // Database law search
  if (includeGreekLaws) {
    searchPromises.push(
      (async () => {
        try {
          const weaviateResults = await weaviateLawSearch(vectorDbQuery, {
            limit: 20,
            legalDomain: enhanced?.legalField ? [enhanced.legalField] : undefined,
          })
          if (weaviateResults.length > 0) {
            let totalChars = 0
            for (const r of weaviateResults) {
              if (totalChars + r.aiVersion.length > maxLawCharacters) break
              lawResults.push(r.aiVersion)
              totalChars += r.aiVersion.length
            }
            console.log(`Laws from Weaviate: ${lawResults.length} (${totalChars} chars)`)
          }
        } catch (e) {
          console.warn('Weaviate law search failed, using Elasticsearch fallback')
        }
        if (lawResults.length === 0) {
          lawResults = await retrieveFromElasticsearch(
            vectorDbQuery,
            '0825_greek_laws_collection',
            maxLawCharacters,
            'voyage-3.5-lite'
          )
          console.log(`Laws from Elasticsearch: ${lawResults.length}`)
        }
      })()
    )
  }

  // Database court decision search
  if (includeGreekCourtDecisions) {
    searchPromises.push(
      (async () => {
        try {
          const weaviateResults = await weaviateCourtSearch(vectorDbQuery)
          if (weaviateResults.length > 0) {
            let totalChars = 0
            for (const r of weaviateResults) {
              if (totalChars + r.aiVersion.length > maxCourtCharacters) break
              courtResults.push(r.aiVersion)
              totalChars += r.aiVersion.length
            }
            console.log(`Courts from Weaviate: ${courtResults.length} (${totalChars} chars)`)
          }
        } catch (e) {
          console.warn('Weaviate court search failed, using Elasticsearch fallback')
        }
        if (courtResults.length === 0) {
          courtResults = await retrieveFromElasticsearch(
            vectorDbQuery,
            '0825_pastcase_collection',
            maxCourtCharacters
          )
          console.log(`Courts from Elasticsearch: ${courtResults.length}`)
        }
      })()
    )
  }

  // Internet search (Perplexity + You.com)
  searchPromises.push(
    (async () => {
      try {
        const perplexityResult = await searchInternetForLegal(perplexityQuery, {
          legalCategories: enhanced?.legalField ? [enhanced.legalField] : undefined,
          keywords: enhanced?.keyPhrases || [],
        })
        if (perplexityResult?.success) {
          const allItems = [
            ...(perplexityResult.legislation || []),
            ...(perplexityResult.jurisprudence || []),
            ...(perplexityResult.developments || []),
          ]
          for (const item of allItems) {
            if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
              internetResults.push(
                `**[Perplexity] ${item.title}**\n\n${item.preview_text}\n\n[Source: ${item.source_domain}](${item.url})`
              )
            }
          }
        }
      } catch (e) {
        console.warn('Perplexity search failed:', e)
      }
    })()
  )

  searchPromises.push(
    (async () => {
      try {
        const youComResult = await searchYouComForLegal(youcomQuery)
        if (youComResult?.success) {
          const allItems = [
            ...(youComResult.legislation || []),
            ...(youComResult.jurisprudence || []),
            ...(youComResult.developments || []),
          ]
          for (const item of allItems) {
            if (item.confidence !== 'low' || item.source_domain !== 'placeholder') {
              internetResults.push(
                `**[You.com] ${item.title}**\n\n${item.preview_text}\n\n[Source: ${item.source_domain}](${item.url})`
              )
            }
          }
        }
      } catch (e) {
        console.warn('You.com search failed:', e)
      }
    })()
  )

  await Promise.allSettled(searchPromises)

  console.log(`Search totals: laws=${lawResults.length}, courts=${courtResults.length}, internet=${internetResults.length}`)

  // Step 3: Combine and rerank
  const combined = [...lawResults, ...courtResults, ...internetResults]

  if (combined.length === 0) {
    return {
      rerankedResults: [],
      lawResults,
      courtResults,
      internetResults,
      queryAnalysis: enhanced ? {
        legalField: enhanced.legalField,
        detectedDomain: enhanced.detectedDomain,
        vectorDbQuery,
      } : undefined,
    }
  }

  let rerankedResults = combined

  try {
    const voyageClient = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY!,
    })

    const dynamicTopK = Math.min(rerankedK, combined.length)

    const voyageResponse: VoyageAI.RerankResponse = await voyageClient.rerank({
      model: 'rerank-2.5-lite',
      query: userQuery,
      documents: combined,
      topK: dynamicTopK,
    })

    let ranked = voyageResponse.data
      ?.map((r) => (typeof r.index === 'number' ? combined[r.index] : undefined))
      .filter((item): item is string => item !== undefined)

    if (ranked && ranked.length > 0) {
      // Court decision guarantee
      if (includeGreekCourtDecisions && courtResults.length > 0) {
        const missingCourts = courtResults.filter((cr) => !ranked!.includes(cr))
        if (missingCourts.length > 0) {
          console.log(`Guaranteeing ${missingCourts.length} court decisions in results`)
          ranked = [...ranked, ...missingCourts.slice(0, 2)]
        }
      }

      rerankedResults = ranked
      console.log(`Reranked: ${rerankedResults.length} results`)
    }
  } catch (e) {
    console.error('Voyage reranking error:', e)
    // Fall through with combined results
  }

  return {
    rerankedResults,
    lawResults,
    courtResults,
    internetResults,
    queryAnalysis: enhanced ? {
      legalField: enhanced.legalField,
      detectedDomain: enhanced.detectedDomain,
      vectorDbQuery,
    } : undefined,
  }
}
