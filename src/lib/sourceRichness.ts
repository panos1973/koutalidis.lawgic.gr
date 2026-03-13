// src/lib/sourceRichness.ts
// Source richness scoring - determines response quality tier and dynamic maxTokens
// Copied from lawgic_corp architecture

import type { ProcessedResult } from './deduplication/lawDeduplication'

export interface RichnessScore {
  score: number;
  tier: 'sparse' | 'moderate' | 'rich';
  maxTokens: number;
  qualityHint: string;
  qualityHintEl: string;
  stats: {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    corroborations: number;
    sourceTypes: number;
    voyageHighScore: number;
  };
}

/**
 * Calculate source richness score based on deduplication results and Voyage reranking.
 *
 * Formula:
 *   richness = (highConf × 3) + (medConf × 1) + (corroborations × 2) + (sourceTypes × 2) + (voyageHigh × 1.5)
 *
 * Tiers:
 *   - sparse (<10): 5K max tokens, "limited sources" hint
 *   - moderate (10-25): 10K max tokens, "solid set of sources" hint
 *   - rich (>25): 14K max tokens, "extensive, high-quality" hint
 */
export function calculateSourceRichness(
  processedResults: ProcessedResult[],
  voyageHighScoreCount: number = 0
): RichnessScore {
  const highConfidence = processedResults.filter(r => r.confidence === 'high').length;
  const mediumConfidence = processedResults.filter(r => r.confidence === 'medium').length;
  const lowConfidence = processedResults.filter(r => r.confidence === 'low').length;
  const corroborations = processedResults.filter(r => (r.corroborationCount || 1) > 1).length;

  // Count distinct source types
  const sourceTypesUsed = new Set(processedResults.map(r => r.source)).size;

  const score =
    (highConfidence * 3) +
    (mediumConfidence * 1) +
    (corroborations * 2) +
    (sourceTypesUsed * 2) +
    (voyageHighScoreCount * 1.5);

  let tier: 'sparse' | 'moderate' | 'rich';
  let maxTokens: number;
  let qualityHint: string;
  let qualityHintEl: string;

  if (score < 10) {
    tier = 'sparse';
    maxTokens = 5000;
    qualityHint = 'Limited sources found. Provide focused analysis based on available information. If sources are insufficient, clearly state limitations.';
    qualityHintEl = 'Περιορισμένες πηγές βρέθηκαν. Παρέχετε εστιασμένη ανάλυση βάσει των διαθέσιμων πληροφοριών. Αν οι πηγές είναι ανεπαρκείς, δηλώστε ξεκάθαρα τους περιορισμούς.';
  } else if (score <= 25) {
    tier = 'moderate';
    maxTokens = 10000;
    qualityHint = 'Solid set of sources available. Provide thorough analysis with full legal reasoning and cross-references between sources.';
    qualityHintEl = 'Καλό σύνολο πηγών διαθέσιμο. Παρέχετε ενδελεχή ανάλυση με πλήρη νομική τεκμηρίωση και παραπομπές μεταξύ πηγών.';
  } else {
    tier = 'rich';
    maxTokens = 14000;
    qualityHint = 'Extensive, high-quality sources available. Provide comprehensive synthesis with cross-references, compare perspectives, and highlight corroborated findings.';
    qualityHintEl = 'Εκτεταμένες, υψηλής ποιότητας πηγές διαθέσιμες. Παρέχετε ολοκληρωμένη σύνθεση με παραπομπές, συγκρίνετε οπτικές και επισημάνετε επιβεβαιωμένα ευρήματα.';
  }

  console.log(`📊 Source Richness: score=${score.toFixed(1)}, tier=${tier}, maxTokens=${maxTokens}`);
  console.log(`High=${highConfidence}, Med=${mediumConfidence}, Low=${lowConfidence}, Corroborations=${corroborations}, Sources=${sourceTypesUsed}, VoyageHigh=${voyageHighScoreCount}`);

  return {
    score,
    tier,
    maxTokens,
    qualityHint,
    qualityHintEl,
    stats: {
      highConfidence,
      mediumConfidence,
      lowConfidence,
      corroborations,
      sourceTypes: sourceTypesUsed,
      voyageHighScore: voyageHighScoreCount,
    },
  };
}
