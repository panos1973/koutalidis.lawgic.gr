# Perfect Legal Search Pipeline - Implementation Plan

## Architecture: Pre-Search → Enrich → Deduplicate → Rank → Inject → Stream

```
REQUEST
  ↓
Message Sanitization & Token Management (exists)
  ↓
1. QUERY ANALYSIS (NEW - Gemini → Claude fallback)
   → legal field + confidence, key phrases, adapted queries per source,
     court search hints, clarification detection
  ↓
2. TWO-PHASE PARALLEL SEARCH (restructure existing)
   Phase A (parallel):
     - Weaviate Laws (GreekLegalDocuments, alpha=0.6, domain filter w/ retry)
     - Weaviate Court Decisions (alpha=0.75, domain filter w/ retry)
     - Graph Context (for temporal queries)
   Phase B (parallel):
     - Perplexity (sonar-pro, adapted query)
     - You.com (adapted query, relevance pre-filter)
     - DeepSeek (adapted query, circuit breaker)
  ↓
3. COURT-LAW ENRICHMENT (NEW)
   → Extract law numbers cited in court decisions
   → Identify which cited laws are MISSING from law results
   → Targeted Weaviate fetch for missing laws (20K char budget)
   → Additive merge into law_data
  ↓
4. COMBINE + DEDUPLICATE (UPGRADE existing)
   → Cross-source similarity scoring (Jaccard + law overlap)
   → Recency-based conflict resolution (newest with substance wins)
   → Corroboration tracking (same law from different sources)
   → Confidence scoring per result (source base + bonuses)
  ↓
5. VOYAGE RERANKING (ENABLE + enhance)
   → Enable useVoyage=true
   → Court decision guarantee (min 3-5 survive reranking)
   → Metadata-aware boosting (domain match, corroboration, source type)
  ↓
6. SMART TRIMMING (exists, minor improvements)
   → Token-aware trimming preserving source distribution
  ↓
7. SOURCE RICHNESS SCORING (NEW)
   → Score = (high×3) + (med×1) + (corroborations×2) + (sources×2)
   → Tiers: sparse (<10) → 5K tokens, moderate (10-25) → 10K, rich (>25) → 14K
   → Quality hint for Claude (focused/thorough/comprehensive)
  ↓
8. CONTEXT INJECTION (UPGRADE)
   → Quality hint + source count summary
   → Search results joined into last user message
   → Dynamic maxTokens based on richness tier
  ↓
9. STREAM (exists, no tools)
   → streamText with dynamic maxTokens
```

## Implementation Steps

### Step 1: Create Query Analyzer (`src/lib/queryAnalyzer.ts`) — NEW FILE
- Gemini 2.5 Flash primary (10s timeout) → Claude Haiku fallback (8s timeout)
- Returns: `{ quality, legalField, legalFieldConfidence, keyPhrases, adaptedQueries: { vectorDb, youcom, perplexity }, courtSearchHints, searchParams }`
- Adapted queries: vectorDb gets full sentence, youcom gets 4-6 keywords, perplexity gets question format
- Legal field detection with confidence (0-1), filtered below 0.4
- Court search hints: courtCategory, subArea, wantsCourtDecisions

### Step 2: Court-Law Enrichment — NEW function in chat route
- After Phase A search completes, scan court decision XML for `<laws_cited>` + inline regex `(\d{1,5})\/(\d{4})`
- Build set of cited law numbers, compare against existing law results
- For missing laws: `retrieveLawsFromWeaviate(missingQuery, 20000)` with alpha=0.6
- Merge results as `database_law` type — ADDITIVE ONLY

### Step 3: Upgrade Deduplication (`src/lib/deduplication/lawDeduplication.ts`)
- Add `calculateContentSimilarity()` — Jaccard on key terms (words > 4 chars) + law number overlap bonus
- Add recency-based conflict resolution: extract newest year, newest with substance wins
- Add corroboration tracking: `{ corroborationCount, corroboratedBy[], isSupplementary }`
- Confidence scoring: database=0.95 base, perplexity=0.70, youcom=0.50 + bonuses for law refs, recency, official URLs
- Court decisions deduplicate by DECISION ID (not cited laws)
- Return enriched results with confidence levels and corroboration info

### Step 4: Source Richness Scoring — NEW function
- Calculate: `(highConf × 3) + (medConf × 1) + (corroborations × 2) + (sourceTypes × 2) + (voyageHighScore × 1.5)`
- Tiers: sparse (<10, 5K tokens), moderate (10-25, 10K), rich (>25, 14K)
- Quality hints per locale (Greek/English)

### Step 5: Enable + Enhance VoyageAI Reranking
- Set `useVoyage = true`
- After reranking, ensure minimum court decisions survive (MIN_COURT_IN_RESULTS = 3)
- If court decisions get reranked out, inject at bottom with score 0.1
- Boost corroborated results and domain-matched court decisions

### Step 6: Update Chat Route (`src/app/[locale]/api/chat/route.ts`)
- Import and use new `analyzeQuery()` instead of basic `analyzeQueryIntent()`
- Pass adapted queries to each search source
- Add court-law enrichment between search and dedup
- Use richness scoring for dynamic maxTokens
- Add quality hints to context injection
- Pass legal domain to court retriever for filtering

### Step 7: Wire Domain Filtering
- Pass `legalField` from query analyzer to court retriever
- Court retriever: filter by `legal_domain`, retry without filter on 0 results
- Law retriever: filter by `legal_domain`, retry without filter on 0 results
