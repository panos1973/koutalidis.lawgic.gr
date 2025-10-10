// File: src/lib/deduplication/lawDeduplication.ts

export interface LawIdentifier {
  lawNumber: string;
  articleNumber: string;
  fullId: string; // "ΑΚ-281"
}

export interface ProcessedResult {
  content: string;
  fullReference: string;
  referenceType: string;
  source: 'database' | 'perplexity' | 'deepseek' | 'youcom';
  lawIdentifiers: Set<string>;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Extract law identifiers from content
 * Enhanced to detect court decisions as well
 */
export function extractLawIdentifiers(content: string): Set<string> {
  const identifiers = new Set<string>();
  
  // Patterns for Greek law references
  const patterns = [
    // άρθρο 281 ΑΚ, άρθρα 35-36 ΑΚ
    /άρθρ[οα](?:ις)?\s+(\d+(?:\s*[-–]\s*\d+)?)\s+(ΑΚ|Ν\.\d+\/\d+)/gi,
    // ΑΚ άρθρο 281, Ν.4548/2018 άρθρο 15
    /(ΑΚ|Ν\.\d+\/\d+)\s+άρθρ[οα](?:ις)?\s+(\d+(?:\s*[-–]\s*\d+)?)/gi,
    // ΑΚ 281, Ν.4548/2018 άρ. 15
    /(ΑΚ|Ν\.\d+\/\d+)\s+(?:άρ\.\s*)?(\d+(?:\s*[-–]\s*\d+)?)/gi,
    // Just law numbers for broader matching
    /(Ν\.\d+\/\d+|ΠΔ\s*\d+\/\d+|ΚΥΑ\s*\d+\/\d+)/gi,
    // Court decisions - ΑΠ 1234/2023, ΣτΕ 567/2022, etc.
    /(ΑΠ|ΣτΕ|ΕφΑθ|ΕφΠειρ|ΠρωτΑθ|ΕλΣυν)\s*(\d+\/\d{4})/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        // Format: LAW-ARTICLE or COURT-DECISION
        identifiers.add(`${match[1]}-${match[2]}`);
      } else if (match[1]) {
        // Just law number or court reference
        identifiers.add(match[1]);
      }
    }
  });
  
  return identifiers;
}

/**
 * Create a simple hash of content for duplicate detection
 */
function createContentHash(content: string): string {
  // Normalize content for comparison
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sΑ-Ωα-ω]/g, '')
    .trim();
  
  // Use first 150 chars as hash (increased from 100 for better accuracy)
  return normalized.substring(0, 150);
}

/**
 * NEW: Unified deduplication for ALL sources (Database, Perplexity, DeepSeek, You.com)
 * This is the main function that handles deduplication across all sources
 */
export function deduplicateAllSources(
  databaseResults: any[],
  perplexityResults: any[],
  deepSeekResults: any[],
  youComResults: any[]
): ProcessedResult[] {
  const processedResults: ProcessedResult[] = [];
  const seenLawIds = new Map<string, ProcessedResult>();
  const seenContentHashes = new Set<string>();
  
  // Process sources in priority order: Database > DeepSeek > Perplexity > You.com
  const sourcesToProcess = [
    { name: 'database' as const, results: databaseResults },
    { name: 'deepseek' as const, results: deepSeekResults },
    { name: 'perplexity' as const, results: perplexityResults },
    { name: 'youcom' as const, results: youComResults }
  ];
  
  console.log('🔍 Deduplication starting with source priorities: Database > DeepSeek > Perplexity > You.com');
  
  for (const source of sourcesToProcess) {
    let sourceSkipped = 0;
    let sourceAdded = 0;
    
    source.results.forEach(result => {
      // Extract content based on possible field names
      const content = result.content || 
                     result.aiVersion || 
                     result.preview_text || 
                     '';
      
      if (!content) {
        sourceSkipped++;
        return; // Skip empty content
      }
      
      const lawIds = extractLawIdentifiers(content);
      const contentHash = createContentHash(content);
      
      // Check for exact content duplicate
      if (seenContentHashes.has(contentHash)) {
        console.log(`  ↳ Skipping exact duplicate from ${source.name}`);
        sourceSkipped++;
        return;
      }
      
      // Check for law identifier overlap
      const overlappingIds = Array.from(lawIds).filter(id => seenLawIds.has(id));
      
      // Decision logic for including or skipping
      let shouldInclude = false;
      let skipReason = '';
      
      if (lawIds.size === 0) {
        // No law identifiers found - include if no exact duplicate
        shouldInclude = true;
      } else if (overlappingIds.length === 0) {
        // New law references - always include
        shouldInclude = true;
      } else if (source.name === 'database') {
        // Database always wins when there's overlap
        shouldInclude = true;
        skipReason = 'Database has priority';
      } else {
        // For other sources with overlap, check existing source
        const existingResult = seenLawIds.get(overlappingIds[0]);
        
        if (existingResult && existingResult.source === 'database') {
          // Skip if database already has this law
          shouldInclude = false;
          skipReason = `Duplicate of database content (${overlappingIds[0]})`;
        } else if (existingResult && existingResult.source === 'deepseek' && source.name !== 'deepseek') {
          // Skip if DeepSeek already has this and current is lower priority
          shouldInclude = false;
          skipReason = `Duplicate of DeepSeek content (${overlappingIds[0]})`;
        } else if (result.confidence === 'high' && existingResult?.confidence !== 'high') {
          // Include if this has higher confidence
          shouldInclude = true;
          skipReason = 'Higher confidence source';
        } else {
          // Skip duplicates from same or lower priority sources
          shouldInclude = false;
          skipReason = `Duplicate from ${source.name} (${overlappingIds[0]})`;
        }
      }
      
      if (shouldInclude) {
        const processed: ProcessedResult = {
          content,
          fullReference: result.fullReference || result.url || '#',
          referenceType: result.referenceType || `${source.name}_law`,
          source: source.name,
          lawIdentifiers: lawIds,
          confidence: result.confidence
        };
        
        processedResults.push(processed);
        seenContentHashes.add(contentHash);
        sourceAdded++;
        
        // Mark law IDs as seen with this result
        lawIds.forEach(id => {
          seenLawIds.set(id, processed);
        });
      } else {
        sourceSkipped++;
        if (skipReason && process.env.NODE_ENV === 'development') {
          console.log(`  ↳ Skipped ${source.name}: ${skipReason}`);
        }
      }
    });
    
    console.log(`  ✓ ${source.name}: Added ${sourceAdded}, Skipped ${sourceSkipped}`);
  }
  
  console.log(`✅ Deduplication complete: ${processedResults.length} unique results`);
  return processedResults;
}

/**
 * BACKWARD COMPATIBILITY: Keep existing function for any code that still uses it
 * Smart law deduplication with source merging (Database + Perplexity only)
 */
export function smartLawDeduplication(
  databaseResults: any[],
  perplexityResults: any[]
): ProcessedResult[] {
  // Call the new unified function with empty arrays for other sources
  return deduplicateAllSources(databaseResults, perplexityResults, [], []);
}

/**
 * Convert processed results back to the expected format
 * This maintains compatibility with existing code
 */
export function convertToExpectedFormat(processedResults: ProcessedResult[]): {
  aiVersions: string[];
  fullReferences: string[];
  referenceTypes: string[];
} {
  return {
    aiVersions: processedResults.map(r => r.content),
    fullReferences: processedResults.map(r => r.fullReference),
    referenceTypes: processedResults.map(r => r.referenceType)
  };
}
