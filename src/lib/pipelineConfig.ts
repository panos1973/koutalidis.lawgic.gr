import type { QueryType, QueryClassification } from './queryClassifier'

// ─── Pipeline Configuration Types ────────────────────────────────────────────

// Effort levels for Sonnet 4.6 / Opus 4.6
// Controls how much reasoning the model applies
export type EffortLevel = 'low' | 'medium' | 'high'

export interface PipelineConfig {
  // Search behavior
  skipDiscoverySearch: boolean
  discoverySearchIterations: number
  enableSecondPassSearch: boolean
  forceSecondPassOnGaps: boolean
  enableContraSearch: boolean

  // Token budgets (multipliers relative to defaults)
  lawCharBudgetMultiplier: number
  caseCharBudgetMultiplier: number
  maxDocumentsMultiplier: number

  // Reranking
  rerankTopKMultiplier: number
  enableTemporalReranking: boolean
  enableRecencyBoost: boolean

  // Source preferences
  internetSearchPriority: 'low' | 'normal' | 'high'
  requireAllSources: boolean

  // Sonnet 4.6 thinking & effort configuration
  // Adaptive thinking: Claude decides when/how much to think
  // Effort: controls reasoning depth (low=fast/cheap, high=thorough)
  enableAdaptiveThinking: boolean
  effort: EffortLevel

  // System prompt adjustments
  systemPromptSuffix: string
  systemPromptSuffixEl: string

  // Logging
  pipelineLabel: string
}

// ─── Pipeline Configurations Per Query Type ──────────────────────────────────

const PIPELINE_CONFIGS: Record<QueryType, PipelineConfig> = {
  /**
   * SIMPLE LOOKUP: Fast path, minimal overhead
   * "What does Article 5 of Law 5090/2024 say?"
   *
   * - Skip discovery search to save latency
   * - Single pass retrieval
   * - Standard reranking
   * - Internet sources at low priority
   */
  simple_lookup: {
    skipDiscoverySearch: true,
    discoverySearchIterations: 0,
    enableSecondPassSearch: false,
    forceSecondPassOnGaps: false,
    enableContraSearch: false,

    lawCharBudgetMultiplier: 0.8,
    caseCharBudgetMultiplier: 0.6,
    maxDocumentsMultiplier: 0.8,

    rerankTopKMultiplier: 0.7,
    enableTemporalReranking: false,
    enableRecencyBoost: false,

    internetSearchPriority: 'low',
    requireAllSources: false,

    // Simple lookups: low effort = fast, cheap, minimal reasoning
    // "What does Article 5 say?" doesn't need deep thinking
    enableAdaptiveThinking: true,
    effort: 'low',

    systemPromptSuffix: '',
    systemPromptSuffixEl: '',

    pipelineLabel: 'SIMPLE_LOOKUP',
  },

  /**
   * TEMPORAL: Amendment chain tracking, emphasis on current law
   * "Has Law 2112/1920 been amended?"
   *
   * - Enhanced discovery search with amendment-aware boosting
   * - Force second pass to catch amendment chains
   * - Temporal reranking enabled
   * - Internet sources at high priority (recent amendments)
   */
  temporal: {
    skipDiscoverySearch: false,
    discoverySearchIterations: 2,
    enableSecondPassSearch: true,
    forceSecondPassOnGaps: true,
    enableContraSearch: false,

    lawCharBudgetMultiplier: 1.2,
    caseCharBudgetMultiplier: 0.5,
    maxDocumentsMultiplier: 1.0,

    rerankTopKMultiplier: 1.0,
    enableTemporalReranking: true,
    enableRecencyBoost: true,

    internetSearchPriority: 'high',
    requireAllSources: false,

    // Temporal queries: medium effort = moderate reasoning for amendment chains
    enableAdaptiveThinking: true,
    effort: 'medium',

    systemPromptSuffix: `

TEMPORAL ANALYSIS INSTRUCTIONS:
This query requires temporal legal analysis. You MUST:
1. Identify the ORIGINAL law and ALL subsequent amendments in chronological order
2. Clearly state which provisions are CURRENTLY IN FORCE vs repealed/amended
3. If a law has been amended, cite both the original and amending law with dates
4. Use a timeline format when multiple amendments exist
5. Flag any provisions with pending future effective dates
6. If you cannot determine the current status with certainty, state this explicitly`,

    systemPromptSuffixEl: `

ΟΔΗΓΙΕΣ ΧΡΟΝΙΚΗΣ ΑΝΑΛΥΣΗΣ:
Αυτό το ερώτημα απαιτεί χρονική νομική ανάλυση. ΠΡΕΠΕΙ:
1. Να εντοπίσετε τον ΑΡΧΙΚΟ νόμο και ΟΛΕΣ τις μεταγενέστερες τροποποιήσεις χρονολογικά
2. Να αναφέρετε ξεκάθαρα ποιες διατάξεις ΙΣΧΥΟΥΝ ΣΗΜΕΡΑ vs καταργήθηκαν/τροποποιήθηκαν
3. Αν ένας νόμος τροποποιήθηκε, να αναφέρετε τόσο τον αρχικό όσο και τον τροποποιητικό νόμο με ημερομηνίες
4. Να χρησιμοποιήσετε μορφή χρονοδιαγράμματος όταν υπάρχουν πολλαπλές τροποποιήσεις
5. Να επισημάνετε τυχόν διατάξεις με μελλοντική ημερομηνία ισχύος
6. Αν δεν μπορείτε να προσδιορίσετε με βεβαιότητα την τρέχουσα κατάσταση, να το δηλώσετε ρητά`,

    pipelineLabel: 'TEMPORAL',
  },

  /**
   * MULTI-HOP: Iterative retrieval, broad coverage
   * "Tax implications of converting a sole proprietorship to an LLC"
   *
   * - Full discovery search
   * - Always do second pass with discovered content
   * - Higher document budgets
   * - All sources active
   */
  multi_hop: {
    skipDiscoverySearch: false,
    discoverySearchIterations: 2,
    enableSecondPassSearch: true,
    forceSecondPassOnGaps: true,
    enableContraSearch: false,

    lawCharBudgetMultiplier: 1.3,
    caseCharBudgetMultiplier: 1.0,
    maxDocumentsMultiplier: 1.2,

    rerankTopKMultiplier: 1.2,
    enableTemporalReranking: false,
    enableRecencyBoost: true,

    internetSearchPriority: 'high',
    requireAllSources: true,

    // Multi-hop queries: high effort = deep reasoning for combining multiple provisions
    enableAdaptiveThinking: true,
    effort: 'high',

    systemPromptSuffix: `

MULTI-STEP ANALYSIS INSTRUCTIONS:
This query requires combining multiple legal provisions. You MUST:
1. Break down the analysis into clear sequential steps
2. For each step, cite the specific law/article that applies
3. Show how provisions from different laws interact and combine
4. Address any conflicts or ambiguities between provisions
5. Provide a synthesized conclusion that ties all steps together
6. Use numbered steps or a structured format for clarity`,

    systemPromptSuffixEl: `

ΟΔΗΓΙΕΣ ΑΝΑΛΥΣΗΣ ΠΟΛΛΑΠΛΩΝ ΒΗΜΑΤΩΝ:
Αυτό το ερώτημα απαιτεί συνδυασμό πολλαπλών νομικών διατάξεων. ΠΡΕΠΕΙ:
1. Να αναλύσετε σε ξεκάθαρα διαδοχικά βήματα
2. Σε κάθε βήμα, να αναφέρετε τον συγκεκριμένο νόμο/άρθρο που εφαρμόζεται
3. Να δείξετε πώς αλληλεπιδρούν και συνδυάζονται διατάξεις διαφορετικών νόμων
4. Να αντιμετωπίσετε τυχόν αντιφάσεις ή ασάφειες μεταξύ διατάξεων
5. Να δώσετε ένα συνθετικό συμπέρασμα που συνδέει όλα τα βήματα
6. Να χρησιμοποιήσετε αριθμημένα βήματα ή δομημένη μορφή για σαφήνεια`,

    pipelineLabel: 'MULTI_HOP',
  },

  /**
   * COMPARATIVE: Parallel retrieval, conflict resolution
   * "How do Greek and EU data protection laws differ?"
   *
   * - Full discovery + contra search
   * - All sources required for comprehensive comparison
   * - Enable contra decision search for case law conflicts
   * - Comparison-aware system prompt
   */
  comparative: {
    skipDiscoverySearch: false,
    discoverySearchIterations: 1,
    enableSecondPassSearch: true,
    forceSecondPassOnGaps: false,
    enableContraSearch: true,

    lawCharBudgetMultiplier: 1.1,
    caseCharBudgetMultiplier: 1.2,
    maxDocumentsMultiplier: 1.3,

    rerankTopKMultiplier: 1.1,
    enableTemporalReranking: false,
    enableRecencyBoost: false,

    internetSearchPriority: 'high',
    requireAllSources: true,

    // Comparative queries: high effort = thorough reasoning for framework comparison
    enableAdaptiveThinking: true,
    effort: 'high',

    systemPromptSuffix: `

COMPARATIVE ANALYSIS INSTRUCTIONS:
This query requires comparing legal frameworks or rulings. You MUST:
1. Present each framework/position separately and clearly
2. Create a structured comparison (side-by-side or point-by-point)
3. Highlight key differences AND similarities
4. Address the legal hierarchy (e.g., EU law supremacy, court hierarchy)
5. If case law is conflicting, explain which court decisions take precedence and why
6. Note any recent trends or emerging consensus
7. Provide a practical conclusion about the current legal landscape`,

    systemPromptSuffixEl: `

ΟΔΗΓΙΕΣ ΣΥΓΚΡΙΤΙΚΗΣ ΑΝΑΛΥΣΗΣ:
Αυτό το ερώτημα απαιτεί σύγκριση νομικών πλαισίων ή αποφάσεων. ΠΡΕΠΕΙ:
1. Να παρουσιάσετε κάθε πλαίσιο/θέση ξεχωριστά και ξεκάθαρα
2. Να δημιουργήσετε δομημένη σύγκριση (παράλληλη ή σημείο προς σημείο)
3. Να επισημάνετε τις βασικές διαφορές ΚΑΙ ομοιότητες
4. Να αντιμετωπίσετε τη νομική ιεραρχία (π.χ. υπεροχή δικαίου ΕΕ, ιεραρχία δικαστηρίων)
5. Αν η νομολογία είναι αντιφατική, να εξηγήσετε ποιες αποφάσεις υπερισχύουν και γιατί
6. Να σημειώσετε πρόσφατες τάσεις ή αναδυόμενη σύγκλιση
7. Να δώσετε πρακτικό συμπέρασμα για το τρέχον νομικό τοπίο`,

    pipelineLabel: 'COMPARATIVE',
  },
}

// ─── Pipeline Config Accessor ────────────────────────────────────────────────

/**
 * Gets the pipeline configuration for a classified query.
 * The config determines how search, retrieval, reranking, and prompting behave.
 */
export function getPipelineConfig(
  classification: QueryClassification
): PipelineConfig {
  const config = PIPELINE_CONFIGS[classification.queryType]

  console.log(
    `[Pipeline] Selected: ${config.pipelineLabel} (confidence: ${classification.confidence}, reasoning: ${classification.reasoning})`
  )

  return config
}

/**
 * Gets the system prompt suffix for the given pipeline and locale.
 */
export function getPipelinePromptSuffix(
  config: PipelineConfig,
  locale: string
): string {
  return locale === 'el'
    ? config.systemPromptSuffixEl
    : config.systemPromptSuffix
}

/**
 * Builds the Anthropic provider options for Sonnet 4.6 thinking & effort.
 * These are passed via providerOptions in the Vercel AI SDK streamText call.
 *
 * Requires @ai-sdk/anthropic >= 1.x for full support.
 * With older versions, these options are safely ignored.
 */
export function getAnthropicProviderOptions(config: PipelineConfig) {
  return {
    anthropic: {
      ...(config.enableAdaptiveThinking && { thinking: { type: 'adaptive' as const } }),
      effort: config.effort,
    },
  }
}

/**
 * Builds provider options with a specific effort level (for non-pipeline routes).
 * Use this for tool routes that don't have the query classifier.
 */
export function getDefaultProviderOptions(effort: EffortLevel = 'medium') {
  return {
    anthropic: {
      thinking: { type: 'adaptive' },
      effort,
    },
  }
}

/**
 * Calculates adjusted character budgets based on pipeline config.
 */
export function getAdjustedBudgets(
  config: PipelineConfig,
  baseLawChars: number,
  baseCaseChars: number,
  baseRerankK: number
): {
  maxLawChars: number
  maxCaseChars: number
  rerankTopK: number
} {
  return {
    maxLawChars: Math.floor(baseLawChars * config.lawCharBudgetMultiplier),
    maxCaseChars: Math.floor(baseCaseChars * config.caseCharBudgetMultiplier),
    rerankTopK: Math.floor(baseRerankK * config.rerankTopKMultiplier),
  }
}
