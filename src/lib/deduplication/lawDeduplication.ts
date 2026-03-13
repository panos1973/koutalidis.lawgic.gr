// File: src/lib/deduplication/lawDeduplication.ts
// UPGRADED: Full lawgic_corp deduplication with similarity scoring, corroboration, recency resolution

export interface LawIdentifier {
  lawNumber: string;
  articleNumber: string;
  fullId: string; // "ΑΚ-281"
}

export interface ProcessedResult {
  content: string;
  fullReference: string;
  referenceType: string;
  source: 'database_law' | 'database_court' | 'perplexity' | 'deepseek' | 'youcom';
  lawIdentifiers: Set<string>;
  confidence: 'high' | 'medium' | 'low';
  sourceIndex?: number;
  corroboratedBy?: string[];
  isSupplementary?: boolean;
  corroborationCount?: number;
}

// ============================================================
// SOURCE PROCESSING ORDER
// ============================================================
// All sources are EQUAL in authority. The processing order below
// is for iteration only — it does NOT determine which source wins.
//
// CONFLICT RESOLUTION RULES:
// 1. NEWEST legislation wins regardless of source
// 2. Same law from multiple sources = CORROBORATION
// 3. Every winning result must carry SUBSTANTIVE DATA
// 4. Perplexity & DeepSeek additionally serve as:
//    a) CORROBORATION for existing results
//    b) SUPPLEMENTATION with different content about the same law
// ============================================================

const SOURCE_PROCESSING_ORDER = [
  'database_law',
  'database_court',
  'youcom',
  'perplexity',
  'deepseek'
] as const;

type SourceType = typeof SOURCE_PROCESSING_ORDER[number];

// ============================================================
// CONFIDENCE SCORING CONFIGURATION
// ============================================================

interface ConfidenceConfig {
  baseScore: number;
  hasLawBonus: number;
  hasDecisionBonus: number;
  hasOfficialUrlBonus: number;
  recencyBonus: number;
}

const CONFIDENCE_CONFIGS: Record<SourceType, ConfidenceConfig> = {
  database_law: {
    baseScore: 0.95,
    hasLawBonus: 0.02,
    hasDecisionBonus: 0.01,
    hasOfficialUrlBonus: 0.01,
    recencyBonus: 0.01
  },
  database_court: {
    baseScore: 0.95,
    hasLawBonus: 0.01,
    hasDecisionBonus: 0.02,
    hasOfficialUrlBonus: 0.01,
    recencyBonus: 0.01
  },
  perplexity: {
    baseScore: 0.70,
    hasLawBonus: 0.12,
    hasDecisionBonus: 0.10,
    hasOfficialUrlBonus: 0.10,
    recencyBonus: 0.08
  },
  deepseek: {
    baseScore: 0.70,
    hasLawBonus: 0.12,
    hasDecisionBonus: 0.10,
    hasOfficialUrlBonus: 0.10,
    recencyBonus: 0.08
  },
  youcom: {
    baseScore: 0.50,
    hasLawBonus: 0.20,
    hasDecisionBonus: 0.15,
    hasOfficialUrlBonus: 0.20,
    recencyBonus: 0.10
  }
};

const OFFICIAL_DOMAINS = [
  'et.gr', 'gov.gr', 'kodiko.gr', 'adjustice.gr',
  'areiospagos.gr', 'ste.gr', 'hellenicparliament.gr',
  'eur-lex.europa.eu', 'taxheaven.gr', 'lawspot.gr', 'lawgic.gr'
];

// ============================================================
// EXTRACTION FUNCTIONS
// ============================================================

export function extractLawIdentifiers(content: string): Set<string> {
  const identifiers = new Set<string>();
  if (!content || typeof content !== 'string') return identifiers;

  const patterns = [
    /άρθρ[οα](?:ις)?\s+(\d+(?:\s*[-–]\s*\d+)?)\s+(ΑΚ|ΠΚ|ΚΠολΔ|ΚΠΔ|Ν\.\s*\d+\/\d+)/gi,
    /(ΑΚ|ΠΚ|ΚΠολΔ|ΚΠΔ|Ν\.\s*\d+\/\d+)\s+άρθρ[οα](?:ις)?\s+(\d+(?:\s*[-–]\s*\d+)?)/gi,
    /(ΑΚ|ΠΚ|ΚΠολΔ|ΚΠΔ|Ν\.\s*\d+\/\d+)\s+(?:άρ\.?\s*)?(\d+(?:\s*[-–]\s*\d+)?)/gi,
    /Ν\.?\s*(\d+\/\d{4})/gi,
    /ΠΔ\.?\s*(\d+\/\d{4})/gi,
    /(?:Κ?ΥΑ|Υ\.Α\.?)\s*(\d+\/\d{4})/gi,
    /(ΑΠ|ΣτΕ|ΕφΑθ|ΕφΘεσ|ΕφΠειρ|ΠρωτΑθ|ΜονΠρ|ΕιρΑθ|ΕλΣυν|Εφετείο\s*\w+)\s*(\d+\/\d{4})/gi,
    /(Οδηγία|Κανονισμός|Directive|Regulation)\s*(?:\(?(ΕΕ|EU|EC)\)?\s*)?(\d+\/\d+)/gi
  ];

  patterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        const normalized = `${match[1].replace(/\s+/g, '')}-${match[2]}`;
        identifiers.add(normalized);
        const base = match[1].replace(/\s+/g, '');
        if (base.match(/\d+\/\d{4}/)) identifiers.add(base);
      } else if (match[1]) {
        const normalized = match[1].replace(/\s+/g, '');
        identifiers.add(normalized);
        if (normalized.match(/^\d+\/\d{4}$/)) identifiers.add(`Ν.${normalized}`);
      }
    }
  });

  return identifiers;
}

export function extractLawNumbers(content: string): string[] {
  if (!content) return [];
  const lawNumbers: string[] = [];
  const patterns = [/Ν\.?\s*(\d+\/\d{4})/gi, /νόμος\s*(\d+\/\d{4})/gi, /νόμου\s*(\d+\/\d{4})/gi];
  patterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) lawNumbers.push(`Ν.${match[1]}`);
    }
  });
  return [...new Set(lawNumbers)];
}

export function extractDecisionNumbers(content: string): string[] {
  if (!content) return [];
  const decisions: string[] = [];
  const pattern = /(ΑΠ|ΣτΕ|ΕφΑθ|ΕφΘεσ|ΕφΠειρ|ΠρωτΑθ|ΜονΠρ|ΕιρΑθ|ΕλΣυν|Εφετείο\s*Αθηνών?)\s*(\d+\/\d{4})/gi;
  const matches = content.matchAll(pattern);
  for (const match of matches) decisions.push(`${match[1]} ${match[2]}`);
  return [...new Set(decisions)];
}

function extractCourtDecisionUniqueId(content: string): string | null {
  if (!content) return null;
  const xmlPatterns = [
    /<citation_label>([^<]+)<\/citation_label>/,
    /<citation>([^<]+)<\/citation>/,
    /<decision_id>([^<]+)<\/decision_id>/,
    /<decision_number>([^<]+)<\/decision_number>/,
    /<chunk_id>([^<]+)<\/chunk_id>/,
  ];
  for (const pattern of xmlPatterns) {
    const match = content.match(pattern);
    if (match && match[1]?.trim()) return match[1].trim();
  }
  const decisionPattern = /(ΑΠ|ΣτΕ|ΕφΑθ|ΕφΘεσ|ΕφΠειρ|ΠρωτΑθ|ΜονΠρ|ΕιρΑθ|ΕλΣυν)\s*(\d+\/\d{4})/i;
  const match = content.match(decisionPattern);
  if (match) return `${match[1]} ${match[2]}`;
  return null;
}

function hasOfficialUrl(content: string): boolean {
  if (!content) return false;
  const contentLower = content.toLowerCase();
  return OFFICIAL_DOMAINS.some(domain => contentLower.includes(domain));
}

function hasRecentContent(content: string): boolean {
  if (!content) return false;
  const currentYear = new Date().getFullYear();
  const recentYears = [currentYear, currentYear - 1, currentYear - 2];
  return recentYears.some(year => content.includes(String(year)));
}

function createContentHash(content: string): string {
  if (!content) return '';
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\sΑ-Ωα-ωά-ώ]/g, '').trim();
  return normalized.substring(0, 150);
}

function calculateContentSimilarity(content1: string, content2: string): number {
  if (!content1 || !content2) return 0;
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\sΑ-Ωα-ωά-ώ]/g, '').trim();
  const norm1 = normalize(content1);
  const norm2 = normalize(content2);
  const lengthRatio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
  if (lengthRatio < 0.3) return lengthRatio * 0.5;

  const extractKeyTerms = (s: string): Set<string> => new Set(s.split(' ').filter(w => w.length > 4));
  const terms1 = extractKeyTerms(norm1);
  const terms2 = extractKeyTerms(norm2);
  if (terms1.size === 0 || terms2.size === 0) return 0;

  const intersection = new Set([...terms1].filter(x => terms2.has(x)));
  const union = new Set([...terms1, ...terms2]);
  const jaccard = intersection.size / union.size;

  const laws1 = extractLawNumbers(content1);
  const laws2 = extractLawNumbers(content2);
  let lawOverlapBonus = 0;
  if (laws1.length > 0 && laws2.length > 0) {
    const lawSet1 = new Set(laws1);
    const lawIntersection = [...lawSet1].filter(x => new Set(laws2).has(x));
    if (lawIntersection.length > 0) lawOverlapBonus = 0.2;
  }

  return Math.min(1, jaccard + lawOverlapBonus);
}

// ============================================================
// CONFIDENCE CALCULATION
// ============================================================

function calculateConfidence(content: string, sourceType: SourceType): 'high' | 'medium' | 'low' {
  const config = CONFIDENCE_CONFIGS[sourceType];
  let score = config.baseScore;
  if (extractLawNumbers(content).length > 0) score += config.hasLawBonus;
  if (extractDecisionNumbers(content).length > 0) score += config.hasDecisionBonus;
  if (hasOfficialUrl(content)) score += config.hasOfficialUrlBonus;
  if (hasRecentContent(content)) score += config.recencyBonus;
  score = Math.min(score, 1.0);
  if (score >= 0.75) return 'high';
  if (score >= 0.50) return 'medium';
  return 'low';
}

// ============================================================
// RECENCY & SUBSTANCE HELPERS
// ============================================================

function extractNewestYear(content: string): number {
  if (!content) return 0;
  const yearPattern = /[Νν]\.?\s*\d{1,5}\/(\d{4})/g;
  let maxYear = 0;
  let match;
  while ((match = yearPattern.exec(content)) !== null) {
    const year = parseInt(match[1]);
    if (year >= 1900 && year <= 2100 && year > maxYear) maxYear = year;
  }
  if (maxYear === 0) {
    const standalonePattern = /\/(\d{4})/g;
    while ((match = standalonePattern.exec(content)) !== null) {
      const year = parseInt(match[1]);
      if (year >= 1900 && year <= 2100 && year > maxYear) maxYear = year;
    }
  }
  return maxYear;
}

function hasSubstantiveContent(content: string): boolean {
  if (!content) return false;
  const lawNumbers = extractLawNumbers(content);
  const decisions = extractDecisionNumbers(content);
  const hasArticleRef = /άρθρ[οα]/i.test(content);
  const hasSubstantialText = content.length > 200;
  return (lawNumbers.length > 0 || decisions.length > 0 || hasArticleRef) && hasSubstantialText;
}

function isSameSourceCategory(a: SourceType, b: SourceType): boolean {
  const categories: Record<SourceType, string> = {
    database_law: 'database',
    database_court: 'database',
    youcom: 'internet',
    perplexity: 'ai_verification',
    deepseek: 'ai_verification',
  };
  return categories[a] === categories[b];
}

// ============================================================
// MAIN DEDUPLICATION FUNCTION
// ============================================================

export function deduplicateAllSources(
  databaseResults: any[],
  perplexityResults: any[],
  deepSeekResults: any[],
  youComResults: any[]
): ProcessedResult[] {
  const processedResults: ProcessedResult[] = [];
  const seenLawIds = new Map<string, ProcessedResult>();
  const seenCourtDecisionIds = new Set<string>();
  const seenContentHashes = new Set<string>();
  let globalSourceIndex = 0;

  // STEP 1: Separate database results into court cases vs laws
  const databaseCaseResults: any[] = [];
  const databaseLawResults: any[] = [];

  databaseResults.forEach(result => {
    const refType = (result.referenceType || '').toLowerCase();
    if (refType.includes('case') || refType.includes('court')) {
      databaseCaseResults.push(result);
    } else {
      databaseLawResults.push(result);
    }
  });

  console.log(`📊 Database split: ${databaseLawResults.length} laws, ${databaseCaseResults.length} court cases`);

  const sourcesToProcess: Array<{ name: SourceType; results: any[]; label: string }> = [
    { name: 'database_law', results: databaseLawResults, label: 'Database Laws' },
    { name: 'database_court', results: databaseCaseResults, label: 'Database Court Cases' },
    { name: 'youcom', results: youComResults, label: 'You.com' },
    { name: 'perplexity', results: perplexityResults, label: 'Perplexity' },
    { name: 'deepseek', results: deepSeekResults, label: 'DeepSeek' }
  ];

  console.log('🔍 Deduplication: All sources equal — newest legislation with substance wins');

  for (const source of sourcesToProcess) {
    let sourceSkipped = 0;
    let sourceAdded = 0;
    let sourceCorroborated = 0;

    const isVerificationSource = source.name === 'perplexity' || source.name === 'deepseek';

    for (const result of source.results) {
      const content = result.content || result.aiVersion || result.preview_text || '';
      if (!content) { sourceSkipped++; continue; }

      const lawIds = extractLawIdentifiers(content);
      const contentHash = createContentHash(content);
      const confidence = calculateConfidence(content, source.name);

      if (seenContentHashes.has(contentHash)) { sourceSkipped++; continue; }

      const isCourtDecision = source.name === 'database_court';

      // Court decisions deduplicate by DECISION ID, not cited laws
      if (isCourtDecision) {
        const courtId = extractCourtDecisionUniqueId(content);
        if (courtId && seenCourtDecisionIds.has(courtId)) {
          sourceSkipped++;
          console.log(`  ↳ Skipped: Duplicate court decision: ${courtId}`);
          continue;
        }

        globalSourceIndex++;
        const processed: ProcessedResult = {
          content,
          fullReference: result.fullReference || result.url || '#',
          referenceType: result.referenceType || `${source.name}_result`,
          source: source.name,
          lawIdentifiers: lawIds,
          confidence,
          sourceIndex: globalSourceIndex,
        };
        processedResults.push(processed);
        seenContentHashes.add(contentHash);
        sourceAdded++;
        if (courtId) seenCourtDecisionIds.add(courtId);
        continue;
      }

      // Law / Internet source dedup: Use law identifiers
      const overlappingIds = Array.from(lawIds).filter(id => seenLawIds.has(id));
      let shouldInclude = true;
      let isSupplementary = false;
      let skipReason = '';

      if (overlappingIds.length > 0) {
        const existingResult = seenLawIds.get(overlappingIds[0]);

        if (existingResult) {
          // Cross-source corroboration
          const isDifferentCategory = !isSameSourceCategory(source.name, existingResult.source);
          if (isDifferentCategory) {
            if (!existingResult.corroboratedBy) existingResult.corroboratedBy = [];
            existingResult.corroboratedBy.push(source.name);
            existingResult.corroborationCount = (existingResult.corroborationCount || 1) + 1;
            if (existingResult.confidence === 'medium') existingResult.confidence = 'high';
            else if (existingResult.confidence === 'low' && (existingResult.corroborationCount || 0) >= 2) existingResult.confidence = 'medium';
            sourceCorroborated++;
            console.log(`  ↳ Cross-source corroboration: ${source.name} confirms ${existingResult.source} on ${overlappingIds[0]}`);
          }

          if (isVerificationSource) {
            const contentSimilarity = calculateContentSimilarity(content, existingResult.content);
            if (contentSimilarity < 0.6) {
              shouldInclude = true;
              isSupplementary = true;
              console.log(`  ↳ ${source.name} SUPPLEMENTS: ${overlappingIds[0]} (similarity: ${contentSimilarity.toFixed(2)})`);
            } else {
              shouldInclude = false;
              skipReason = `Corroboration only (similarity: ${contentSimilarity.toFixed(2)}) for ${overlappingIds[0]}`;
            }
          } else {
            // Primary source conflict — NEWEST WITH SUBSTANCE WINS
            const existingYear = extractNewestYear(existingResult.content);
            const newYear = extractNewestYear(content);
            const newHasSubstance = hasSubstantiveContent(content);
            const existingHasSubstance = hasSubstantiveContent(existingResult.content);

            let shouldReplace = false;
            let replaceReason = '';

            if (newYear > existingYear && newHasSubstance) {
              shouldReplace = true;
              replaceReason = `newer legislation (${newYear} > ${existingYear})`;
            } else if (newYear === existingYear) {
              if (newHasSubstance && !existingHasSubstance) {
                shouldReplace = true;
                replaceReason = `more substantive content`;
              } else if (confidence === 'high' && existingResult.confidence !== 'high') {
                shouldReplace = true;
                replaceReason = `higher confidence (${confidence} vs ${existingResult.confidence})`;
              }
            }

            if (shouldReplace) {
              const oldIndex = processedResults.findIndex(r => r === existingResult);
              if (oldIndex !== -1) processedResults.splice(oldIndex, 1);
              console.log(`  ↳ Replacing ${existingResult.source} with ${source.name}: ${replaceReason}`);
              shouldInclude = true;
            } else {
              shouldInclude = false;
              skipReason = `Duplicate: ${overlappingIds[0]} — existing from ${existingResult.source} kept`;
            }
          }
        }
      }

      if (shouldInclude) {
        globalSourceIndex++;
        const replacedResult = overlappingIds.length > 0 ? seenLawIds.get(overlappingIds[0]) : undefined;
        const inheritedCorroboration = replacedResult?.corroboratedBy || [];
        const inheritedCount = replacedResult?.corroborationCount || 1;

        const processed: ProcessedResult = {
          content,
          fullReference: result.fullReference || result.url || '#',
          referenceType: result.referenceType || `${source.name}_result`,
          source: source.name,
          lawIdentifiers: lawIds,
          confidence,
          sourceIndex: globalSourceIndex,
          isSupplementary,
          corroboratedBy: inheritedCorroboration.length > 0
            ? [...inheritedCorroboration, ...(replacedResult?.source ? [replacedResult.source] : [])]
            : undefined,
          corroborationCount: inheritedCorroboration.length > 0 ? inheritedCount + 1 : 1,
        };

        processedResults.push(processed);
        seenContentHashes.add(contentHash);
        sourceAdded++;
        if (!isSupplementary) lawIds.forEach(id => seenLawIds.set(id, processed));
      } else {
        sourceSkipped++;
        if (skipReason) console.log(`  ↳ Skipped: ${skipReason}`);
      }
    }

    const corrobMsg = sourceCorroborated > 0 ? `, Corroborated ${sourceCorroborated}` : '';
    console.log(`  ✓ ${source.label}: Added ${sourceAdded}, Skipped ${sourceSkipped}${corrobMsg}`);
  }

  const corroboratedResults = processedResults.filter(r => (r.corroborationCount || 1) > 1);
  const supplementaryResults = processedResults.filter(r => r.isSupplementary);

  const summary = {
    total: processedResults.length,
    bySource: {
      youcom: processedResults.filter(r => r.source === 'youcom').length,
      database_law: processedResults.filter(r => r.source === 'database_law').length,
      database_court: processedResults.filter(r => r.source === 'database_court').length,
      perplexity: processedResults.filter(r => r.source === 'perplexity').length,
      deepseek: processedResults.filter(r => r.source === 'deepseek').length
    },
    byConfidence: {
      high: processedResults.filter(r => r.confidence === 'high').length,
      medium: processedResults.filter(r => r.confidence === 'medium').length,
      low: processedResults.filter(r => r.confidence === 'low').length
    },
    verification: {
      corroboratedClaims: corroboratedResults.length,
      supplementaryInfo: supplementaryResults.length,
      averageCorroboration: corroboratedResults.length > 0
        ? (corroboratedResults.reduce((sum, r) => sum + (r.corroborationCount || 1), 0) / corroboratedResults.length).toFixed(1)
        : 0
    }
  };

  console.log(`✅ Deduplication complete:`, summary);
  if (supplementaryResults.length > 0) {
    console.log(`📎 ${supplementaryResults.length} supplementary sources added (additional context)`);
  }

  return processedResults;
}

// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================

export function smartLawDeduplication(
  databaseResults: any[],
  perplexityResults: any[]
): ProcessedResult[] {
  return deduplicateAllSources(databaseResults, perplexityResults, [], []);
}

export function convertToExpectedFormat(processedResults: ProcessedResult[]): {
  aiVersions: string[];
  fullReferences: string[];
  referenceTypes: string[];
  confidences: ('high' | 'medium' | 'low')[];
  sourceIndices: number[];
  corroborationInfo: Array<{
    index: number;
    corroboratedBy: string[];
    corroborationCount: number;
    isSupplementary: boolean;
  }>;
} {
  return {
    aiVersions: processedResults.map(r => r.content),
    fullReferences: processedResults.map(r => r.fullReference),
    referenceTypes: processedResults.map(r => r.referenceType),
    confidences: processedResults.map(r => r.confidence),
    sourceIndices: processedResults.map(r => r.sourceIndex || 0),
    corroborationInfo: processedResults.map((r, i) => ({
      index: i,
      corroboratedBy: r.corroboratedBy || [],
      corroborationCount: r.corroborationCount || 1,
      isSupplementary: r.isSupplementary || false
    }))
  };
}
