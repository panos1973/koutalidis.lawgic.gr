// src/lib/legalSearchPipeline.ts
// Shared legal search pipeline used by all tools (case analysis, contract comparison,
// document creation, case study). Provides query analysis, parallel database + internet
// search, deduplication, VoyageAI reranking with court decision guarantee, and smart
// context trimming — matching the law bot's full pipeline.

import { weaviateLawSearch } from '@/lib/retrievers/weaviate_law_retriever'
import { weaviateCourtSearch } from '@/lib/retrievers/weaviate_court_retriever'
import { elasticsearchRetrieverHybridSearch } from '@/lib/retrievers/elasticsearch_retriever'
import { decodeEscapedString } from '@/lib/decoding'
import { analyzeQuery } from '@/lib/queryAnalyzer'
import { searchInternetForLegal } from '@/lib/internetSearchUtils'
import { searchYouComForLegal } from '@/lib/youComSearchUtils'
import { deduplicateAllSources, convertToExpectedFormat } from '@/lib/deduplication/lawDeduplication'
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
  /** Max tokens for final output (default: 12000) */
  maxTokens?: number
  /** Conversation messages for query analysis context */
  conversationMessages?: any[]
  /** Locale for query analysis */
  locale?: string
}

export interface LegalSearchResult {
  /** All results after dedup + reranking + trimming */
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
  /** Stats from deduplication */
  dedupStats?: {
    totalBefore: number
    totalAfter: number
  }
}

// ─── Internal result type for tracking metadata through pipeline ────────────

interface TaggedResult {
  content: string
  fullReference: string
  referenceType: string
  confidence?: string
}

// ─── Smart Context Trimming ─────────────────────────────────────────────────

function smartContextTrimming(
  documents: string[],
  maxTokens: number
): string[] {
  const estimateTokens = (text: string) => Math.ceil(text.length / 3.5)
  let totalTokens = 0
  const result: string[] = []

  // Sort by importance: recent dates and law references score higher
  const sortedDocs = [...documents].sort((a, b) => {
    const aScore =
      (a.match(/202[3-6]/g) || []).length +
      (a.match(/[Νν]\.\s*\d+\/\d{4}/g) || []).length
    const bScore =
      (b.match(/202[3-6]/g) || []).length +
      (b.match(/[Νν]\.\s*\d+\/\d{4}/g) || []).length
    return bScore - aScore
  })

  for (const doc of sortedDocs) {
    const docTokens = estimateTokens(doc)
    if (totalTokens + docTokens <= maxTokens) {
      result.push(doc)
      totalTokens += docTokens
    } else {
      // Try to fit a trimmed version if we have space
      if (totalTokens < maxTokens * 0.9) {
        const remainingTokens = maxTokens - totalTokens
        const remainingChars = remainingTokens * 3.5
        let partialText = doc.substring(0, remainingChars)

        // Smart truncation at natural boundaries
        const paragraphBreak = partialText.lastIndexOf('\n\n')
        const sentenceBreak = Math.max(
          partialText.lastIndexOf('. '),
          partialText.lastIndexOf('; '),
          partialText.lastIndexOf(': ')
        )

        if (paragraphBreak > partialText.length * 0.5) {
          partialText = partialText.substring(0, paragraphBreak + 2) + '...'
        } else if (sentenceBreak > partialText.length * 0.7) {
          partialText = partialText.substring(0, sentenceBreak + 1) + '...'
        } else {
          partialText += '...'
        }

        result.push(partialText)
      }
      break
    }
  }

  console.log(`Smart trimming: ${documents.length} docs -> ${result.length} docs, ~${totalTokens} tokens`)
  return result
}

// ─── Elasticsearch Fallback ─────────────────────────────────────────────────

async function retrieveFromElasticsearch(
  query: string,
  index: string,
  maxCharacters: number,
  model_name?: string
): Promise<TaggedResult[]> {
  try {
    const retrieved_data = await elasticsearchRetrieverHybridSearch(query, {
      knn_k: 20,
      knn_num_candidates: 60,
      rrf_rank_window_size: 15,
      rrf_rank_constant: 20,
      index,
      model_name,
    })

    let totalChars = 0
    const filtered: TaggedResult[] = []
    for (const doc of retrieved_data) {
      const content = decodeEscapedString(doc.fullReference)
      if (totalChars + content.length <= maxCharacters) {
        filtered.push({
          content,
          fullReference: content,
          referenceType: index.includes('pastcase') ? 'database_court' : 'database_law',
        })
        totalChars += content.length
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
 * 3. Deduplicates with Jaccard similarity, corroboration, recency resolution
 * 4. Applies VoyageAI reranking with court decision guarantee
 * 5. Smart context trimming to fit token budget
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
    maxTokens = 12_000,
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

  // Step 2: Parallel searches — collect structured results for dedup
  let dbLawResults: TaggedResult[] = []
  let dbCourtResults: TaggedResult[] = []
  let perplexityResults: TaggedResult[] = []
  let youcomResults: TaggedResult[] = []

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
              dbLawResults.push({
                content: r.aiVersion,
                fullReference: r.fullReference,
                referenceType: 'database_law',
              })
              totalChars += r.aiVersion.length
            }
            console.log(`Laws from Weaviate: ${dbLawResults.length} (${totalChars} chars)`)
          }
        } catch (e) {
          console.warn('Weaviate law search failed, using Elasticsearch fallback')
        }
        if (dbLawResults.length === 0) {
          dbLawResults = await retrieveFromElasticsearch(
            vectorDbQuery,
            '0825_greek_laws_collection',
            maxLawCharacters,
            'voyage-3.5-lite'
          )
          console.log(`Laws from Elasticsearch: ${dbLawResults.length}`)
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
              dbCourtResults.push({
                content: r.aiVersion,
                fullReference: r.fullReference,
                referenceType: 'database_court',
              })
              totalChars += r.aiVersion.length
            }
            console.log(`Courts from Weaviate: ${dbCourtResults.length} (${totalChars} chars)`)
          }
        } catch (e) {
          console.warn('Weaviate court search failed, using Elasticsearch fallback')
        }
        if (dbCourtResults.length === 0) {
          dbCourtResults = await retrieveFromElasticsearch(
            vectorDbQuery,
            '0825_pastcase_collection',
            maxCourtCharacters
          )
          console.log(`Courts from Elasticsearch: ${dbCourtResults.length}`)
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
              perplexityResults.push({
                content: `**[Perplexity] ${item.title}**\n\n${item.preview_text}\n\n[Source: ${item.source_domain}](${item.url})`,
                fullReference: item.url || '#',
                referenceType: item.category === 'jurisprudence' ? 'perplexity_jurisprudence' : 'perplexity_legislation',
                confidence: item.confidence,
              })
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
              youcomResults.push({
                content: `**[You.com] ${item.title}**\n\n${item.preview_text}\n\n[Source: ${item.source_domain}](${item.url})`,
                fullReference: item.url || '#',
                referenceType: item.category === 'jurisprudence' ? 'youcom_jurisprudence' : 'youcom_legislation',
                confidence: item.confidence,
              })
            }
          }
        }
      } catch (e) {
        console.warn('You.com search failed:', e)
      }
    })()
  )

  await Promise.allSettled(searchPromises)

  const totalBefore = dbLawResults.length + dbCourtResults.length + perplexityResults.length + youcomResults.length
  console.log(`Search totals: dbLaws=${dbLawResults.length}, dbCourts=${dbCourtResults.length}, perplexity=${perplexityResults.length}, youcom=${youcomResults.length}`)

  // Return early arrays for callers that want raw counts
  const lawResultStrings = dbLawResults.map(r => r.content)
  const courtResultStrings = dbCourtResults.map(r => r.content)
  const internetResultStrings = [...perplexityResults, ...youcomResults].map(r => r.content)

  if (totalBefore === 0) {
    return {
      rerankedResults: [],
      lawResults: lawResultStrings,
      courtResults: courtResultStrings,
      internetResults: internetResultStrings,
      queryAnalysis: enhanced ? {
        legalField: enhanced.legalField,
        detectedDomain: enhanced.detectedDomain,
        vectorDbQuery,
      } : undefined,
    }
  }

  // Step 3: Deduplication — Jaccard similarity, corroboration, recency resolution
  const databaseResults = [...dbLawResults, ...dbCourtResults]
  const dedupResults = deduplicateAllSources(
    databaseResults,
    perplexityResults,
    [], // no deepseek in tools
    youcomResults
  )
  const dedupFormatted = convertToExpectedFormat(dedupResults)
  const totalAfter = dedupFormatted.aiVersions.length

  console.log(`Dedup: ${totalBefore} -> ${totalAfter} unique results`)

  // Step 4: VoyageAI reranking with court decision guarantee
  let rerankedResults = dedupFormatted.aiVersions

  if (rerankedResults.length > 0) {
    try {
      const voyageClient = new VoyageAIClient({
        apiKey: process.env.VOYAGE_API_KEY!,
      })

      const dynamicTopK = Math.min(rerankedK, rerankedResults.length)

      const voyageResponse: VoyageAI.RerankResponse = await voyageClient.rerank({
        model: 'rerank-2.5-lite',
        query: userQuery,
        documents: rerankedResults,
        topK: dynamicTopK,
      })

      let ranked = voyageResponse.data
        ?.map((r) => (typeof r.index === 'number' ? rerankedResults[r.index] : undefined))
        .filter((item): item is string => item !== undefined)

      if (ranked && ranked.length > 0) {
        // Court decision guarantee
        if (includeGreekCourtDecisions && courtResultStrings.length > 0) {
          // Find court results that survived dedup but not reranking
          const courtTypes = dedupFormatted.referenceTypes
          const courtIndices = courtTypes
            .map((t, i) => ({ t, i }))
            .filter(({ t }) => t.includes('court') || t.includes('case') || t.includes('jurisprudence'))
            .map(({ i }) => i)

          const missingCourts = courtIndices
            .map(i => rerankedResults[i])
            .filter(c => c && !ranked!.includes(c))

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
    }
  }

  // Step 5: Smart context trimming
  rerankedResults = smartContextTrimming(rerankedResults, maxTokens)

  return {
    rerankedResults,
    lawResults: lawResultStrings,
    courtResults: courtResultStrings,
    internetResults: internetResultStrings,
    queryAnalysis: enhanced ? {
      legalField: enhanced.legalField,
      detectedDomain: enhanced.detectedDomain,
      vectorDbQuery,
    } : undefined,
    dedupStats: {
      totalBefore,
      totalAfter,
    },
  }
}
