// src/lib/youComSearchUtils.ts
import dotenv from 'dotenv';

dotenv.config();

// === INTERFACES ===
interface CategorizedResult {
  title: string;
  url: string;
  preview_text: string;
  source_domain: string;
  publication_date?: string;
  confidence: 'high' | 'medium' | 'low';
  category: 'legislation' | 'jurisprudence' | 'development';
  // Optional fields for internal use
  detected_laws?: string[];
  law_confidence?: number;
}

interface StructuredPerplexityResults {
  legislation: CategorizedResult[];
  jurisprudence: CategorizedResult[];
  developments: CategorizedResult[];
  metadata: {
    totalResults: number;
    searchQuery: string;
    timestamp: string;
    error?: string;
    // Optional metadata for tracking
    detected_laws_summary?: string[];
    // Track EUR-Lex URLs found
    eurlex_urls_found?: string[];
  };
  success: boolean;
}

interface YouComResult {
  url: string;
  title: string;
  description?: string;
  snippet?: string;
  snippets?: string[];
  age?: string;
  source_domain?: string; // Added this property
  domain?: string; // Added this property as alternative
}

interface YouComSearchResponse {
  hits?: any[];
  results?: any[];
  error?: string;
}

// NEW: Type for search context
interface SearchContext {
  keywords?: string[];
  detectedLaws?: string[];
  legalCategories?: string[];
  temporalEmphasis?: boolean;
}

// === CONFIGURATION - FIXED API KEY HANDLING ===
const CONFIG = {
  // Use environment variable OR hardcoded key with proper escaping
  API_KEY: process.env.YOUCOM_API_KEY ||
           process.env.You_com_api ||
           'ydc-sk-cf3700ca197e0cf0-Q7nZD16yX5mlViAPXNK5V0sA3MfKwgkx-a28af613',
  API_URL: 'https://api.ydc-index.io/search', // Correct endpoint without /v1
  TIMEOUT: 35000,
  MAX_RETRIES: 2,
  MAX_RESULTS: 20, // Increased from 10 to get more results
};

// Alternative: If the above doesn't work, try storing the key in parts
const API_KEY_PART1 = 'ydc-sk-abc6226161e4cad0-NUkBk8NUFPZtWmG5N5s1e7BbTFRUUWXU-9d183b37';
const API_KEY_PART2 = '<__>';
const API_KEY_PART3 = '1S30vBETU8N2v5f4EV8pGIIF';
const ALTERNATIVE_API_KEY = API_KEY_PART1 + API_KEY_PART2 + API_KEY_PART3;

// === ENHANCED GREEK LEGAL DOMAINS ===
const LEGAL_DOMAINS = {
  HIGH: [
    'hellenicparliament.gr', 'areiospagos.gr', 'ste.gr', 'et.gr', 
    'eur-lex.europa.eu', 'ministryofjustice.gr', 'dsanet.gr',
    'adjustice.gr', 'nsk.gr',
    'curia.europa.eu',  // Court of Justice of the EU
    'europa.eu',        // EU official sites
  ],
  MEDIUM: [
    'lawspot.gr', 'ethemis.gr', 'nomosphysis.gr', 'lawnet.gr',
    'taxheaven.gr', 'e-nomothesia.gr', 'isocrates.gr', 'nomos.gr'
  ]
};

// === COMPREHENSIVE GREEK LAW PATTERNS ===
const GREEK_LAW_PATTERNS = {
  // Laws - All variations
  NOMOS: [
    /[Νν]\.?\s*(\d{1,4})\/(\d{4})/gi,          // Ν. 4412/2016, ν.4412/2016
    /[Νν]όμ(?:ος|ου)?\s+(\d{1,4})\/(\d{4})/gi, // Νόμος 4412/2016
    /άρθρ?\.?\s*(\d+)\s+(?:του\s+)?[Νν]\.?\s*(\d{1,4})\/(\d{4})/gi, // άρθρο 15 του Ν. 4412/2016
  ],
  // Presidential Decrees
  PD: [
    /Π\.?Δ\.?\s*(\d{1,4})\/(\d{4})/gi,         // Π.Δ. 123/2020
    /ΠΔ\s*(\d{1,4})\/(\d{4})/gi,               // ΠΔ 123/2020
    /π\.?δ\.?\s*(\d{1,4})\/(\d{4})/gi,         // π.δ. 123/2020
  ],
  // Court Decisions
  COURT: [
    /ΑΠ\s*(\d{1,5})\/(\d{4})/gi,               // ΑΠ 3145/2024 (Supreme Court)
    /ΣτΕ\s*(\d{1,5})\/(\d{4})/gi,              // ΣτΕ 1234/2023 (Council of State)
    /Εφ(?:Αθ|Θεσς?|Πειρ)\s*(\d{1,5})\/(\d{4})/gi, // ΕφΑθ 567/2023 (Appeals Courts)
    /ΕλΣυν\s*(\d{1,5})\/(\d{4})/gi,            // ΕλΣυν 789/2023 (Court of Audit)
    /ΔιοικΕφΑθ\s*(\d{1,5})\/(\d{4})/gi,        // Administrative Appeals
    /ΠρωτΑθ\s*(\d{1,5})\/(\d{4})/gi,           // First Instance
  ],
  // Legal Codes
  CODES: [
    /ΑΚ\s*(\d{1,4})/gi,                        // ΑΚ 369 (Civil Code)
    /άρθρ?\.?\s*(\d+)\s+ΑΚ/gi,                 // άρθρο 369 ΑΚ
    /ΚΠολΔ\s*(\d{1,4})/gi,                     // Civil Procedure Code
    /ΠΚ\s*(\d{1,4})/gi,                        // Criminal Code
    /ΚΠΔ\s*(\d{1,4})/gi,                       // Criminal Procedure Code
    /ΕμπΚ\s*(\d{1,4})/gi,                      // Commercial Code
  ],
  // Ministerial Decisions
  MINISTERIAL: [
    /ΥΑ\s*[\d\/\-\.]+/gi,                      // ΥΑ 135800/Δ2/23-08-2016
    /ΚΥΑ\s*[\d\/\-\.]+/gi,                     // Joint Ministerial
    /Φ\.?\d+\/[\d\/]+/gi,                      // Φ.12/657/70691/Δ1
  ],
  // EU Regulations in Greek
  EU: [
    /Καν(?:ονισμός|ονισμού)?\s*\(?ΕΕ\)?\s*(?:αριθ\.?)?\s*(\d{1,4})\/(\d{4})/gi, // Κανονισμός (ΕΕ) 2016/679
    /Οδηγία\s+(\d{4})\/(\d{1,4})\/ΕΕ/gi,       // Οδηγία 2019/1937/ΕΕ
    /GDPR/gi,                                   // GDPR mentions
    /Regulation\s*\(?EU\)?\s*(\d{1,4})\/(\d{4})/gi, // Regulation (EU) 2016/679
    /Directive\s+(\d{4})\/(\d{1,4})\/EU/gi,    // Directive 2019/1937/EU
    /C-\d{1,4}\/\d{2}/gi,                      // CJEU case numbers C-311/18
    /T-\d{1,4}\/\d{2}/gi,                      // General Court T-123/20
    /ΔΕΕ/g,                                    // Court of Justice abbreviation
    /CJEU/gi,                                  // Court of Justice EU
    /ECJ/gi,                                   // European Court of Justice
  ],
  // FEK (Government Gazette)
  FEK: [
    /ΦΕΚ\s*(\d{1,4})\/([Α-Ω])\/(\d{1,2}[\-\.]\d{1,2}[\-\.]\d{4})/gi, // ΦΕΚ 94/Α/27-5-2016
  ],
  // Catch-all for number/year patterns in legal context
  GENERAL: [
    /(\d{3,4})\/(\d{4})/gi,                    // Any 3-4 digit number followed by year
  ]
};

// === Extract EUR-Lex URLs from text content ===
function extractEurLexUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  const urls = new Set<string>();
  
  // Specific patterns for valid EUR-Lex and Curia document URLs
  const patterns = [
    // EUR-Lex CELEX URLs (most common and reliable)
    /https?:\/\/eur-lex\.europa\.eu\/legal-content\/[A-Z]{2}\/(?:TXT|ALL)\/?\?uri=(?:CELEX:)?[\w]+/gi,
    // EUR-Lex ELI URLs 
    /https?:\/\/eur-lex\.europa\.eu\/eli\/[^\/\s<>"']+\/\d{4}\/\d+/gi,
    // Curia case law URLs
    /https?:\/\/curia\.europa\.eu\/juris\/[^\s<>"']+\.jsf\?[^\s<>"']*/gi,
    // Simple EUR-Lex domain URLs that might be document links
    /https?:\/\/eur-lex\.europa\.eu\/[^\s<>"']{20,}/gi  // At least 20 chars after domain
  ];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(url => {
        // Clean URL (remove trailing punctuation that might be from text)
        const cleanUrl = url.replace(/[.,;:!?)\]]+$/, '');
        // Basic validation - should contain some identifier
        if (cleanUrl.includes('CELEX') || cleanUrl.includes('/eli/') || 
            cleanUrl.includes('juris') || /\d{4}/.test(cleanUrl)) {
          urls.add(cleanUrl);
        }
      });
    }
  });
  
  // ADD: Construct search URLs for mentioned but unlinked EU directives
  const euReferencePatterns = [
    /\b(Directive|Οδηγία)\s+(\d{4})\/(\d+)(?!.*EUR-Lex)/gi,
    /\b(Regulation|Κανονισμός)\s+\(EU\)\s+(\d{4})\/(\d+)(?!.*EUR-Lex)/gi,
  ];
  
  euReferencePatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const year = match[2];
      const number = match[3];
      urls.add(`https://eur-lex.europa.eu/search.html?qid=&text=${year}/${number}`);
    }
  });
  
  return Array.from(urls);
}

// === Enhance query for EU law detection ===
function enhanceQueryForEULaws(query: string): string {
  // Quick detection of EU law references
  const euPatterns = [
    /κανονισμ.*\(ΕΕ\)/i,           // Greek: Κανονισμός (ΕΕ)
    /οδηγία.*\d{4}\/\d+/i,          // Greek: Οδηγία with numbers
    /regulation.*\(EU\)/i,           // English: Regulation (EU)
    /directive.*\d{4}\/\d+/i,       // English: Directive with numbers
    /\d{3,4}\/\d{4}.*(?:ΕΕ|EU)/i,  // Number pattern with EU/ΕΕ
    /GDPR|ΓΚΠΔ/i,                   // GDPR specific
    /[CT]-\d+\/\d{2}/i,             // CJEU case format
    /ευρωπαϊκ.*(?:κανονισμ|οδηγ)/i // European regulation/directive
  ];
  
  const hasEULaw = euPatterns.some(pattern => pattern.test(query));
  
  if (!hasEULaw) return query;
  
  // Add subtle hints to find articles with EUR-Lex links
  return `${query} ("EUR-Lex" OR "ευρωπαϊκός κανονισμός" OR "επίσημο κείμενο")`;
}

// === FIXED: Extract laws from text with robust matching ===
function extractGreekLaws(text: string): string[] {
  const detectedLaws = new Set<string>();
  
  if (!text || typeof text !== 'string') return [];
  
  // Process up to 2000 chars to catch EUR-Lex URLs
  const processText = text.substring(0, 2000);
  
  // Check for legal context indicators
  const hasLegalContext = /νόμ|άρθρ|διάταγμ|απόφασ|δικαστήρ|ΦΕΚ|κώδικ|ΣτΕ|ΑΠ/i.test(processText);
  
  // Check each pattern type
  for (const [type, patterns] of Object.entries(GREEK_LAW_PATTERNS)) {
    // Skip general pattern unless we have legal context
    if (type === 'GENERAL' && !hasLegalContext) continue;
    
    for (const pattern of patterns) {
      try {
        // FIXED: More robust matchAll support check
        if (typeof processText.matchAll === 'function') {
          const matches = Array.from(processText.matchAll(pattern));
          for (const match of matches) {
            const fullMatch = match[0].trim();
            if (fullMatch && fullMatch.length > 2) {
              detectedLaws.add(fullMatch);
            }
          }
        } else {
          // Fallback for environments without matchAll
          let match;
          const globalPattern = new RegExp(pattern.source, pattern.flags);
          while ((match = globalPattern.exec(processText)) !== null) {
            const fullMatch = match[0].trim();
            if (fullMatch && fullMatch.length > 2) {
              detectedLaws.add(fullMatch);
            }
          }
        }
      } catch (e) {
        // Final fallback using simple match
        try {
          const simpleMatches = processText.match(pattern);
          if (simpleMatches && simpleMatches[0]) {
            const fullMatch = simpleMatches[0].trim();
            if (fullMatch && fullMatch.length > 2) {
              detectedLaws.add(fullMatch);
            }
          }
        } catch (fallbackError) {
          console.warn(`Pattern matching error for ${type}:`, fallbackError);
        }
      }
    }
  }
  
  // Also extract EUR-Lex URLs as "laws"
  const eurLexUrls = extractEurLexUrls(processText);
  eurLexUrls.forEach(url => {
    detectedLaws.add(`[EUR-LEX]: ${url}`);
  });
  
  return Array.from(detectedLaws);
}

// === URL Validation Function ===
function isLikelyValidLegalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Reject obvious non-content URLs
  const invalidPatterns = [
    /\/search\?/i,
    /\/results\?/i,
    /google\.com\/search/i,
    /bing\.com\/search/i,
    /\#$/,  // URLs ending with just #
    /javascript:/i,
    /void\(0\)/i,
    /\.pdf\.tmp$/i,  // Temporary files
    /\/print$/i,  // Print-only pages
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(url)) {
      console.log(`⚠️ [YC] Rejecting invalid URL pattern: ${url}`);
      return false;
    }
  }
  
  // Accept known good patterns
  const validPatterns = [
    /\.pdf$/i,  // PDF documents
    /\/law\/\d+/i,  // Law pages with IDs
    /\/decision\/\d+/i,  // Court decisions
    /\/article\/\d+/i,  // Articles
    /\/(νόμος|nomos)\/\d+/i,  // Greek law URLs
    /fek\.gr/i,  // Government Gazette
    /et\.gr/i,  // National Printing House
    /eur-lex\.europa\.eu/i,  // EUR-Lex
    /curia\.europa\.eu/i,  // CJEU
  ];
  
  for (const pattern of validPatterns) {
    if (pattern.test(url)) {
      return true;
    }
  }
  
  // Check if it's from a known legal domain
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    if (LEGAL_DOMAINS.HIGH.concat(LEGAL_DOMAINS.MEDIUM).some(d => domain.includes(d))) {
      return true;
    }
  } catch (e) {
    console.warn(`Invalid URL structure: ${url}`);
    return false;
  }
  
  // Default: keep it
  return true;
}

// === SIMPLE CACHE ===
const cache = new Map<string, { data: StructuredPerplexityResults; timestamp: number }>();
const CACHE_TTL = 1800000; // 30 minutes

function getCached(key: string): StructuredPerplexityResults | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return { ...cached.data };
}

function setCache(key: string, data: StructuredPerplexityResults): void {
  cache.set(key, { 
    data: { ...data }, 
    timestamp: Date.now() 
  });
  
  // Keep cache size reasonable
  if (cache.size > 50) {
    const iterator = cache.keys();
    const firstEntry = iterator.next();
    if (!firstEntry.done && firstEntry.value !== undefined) {
      cache.delete(firstEntry.value);
    }
  }
}

// === RATE LIMITER ===
let requestCount = 0;
let lastResetTime = Date.now();
let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset counter every minute
  if (now - lastResetTime >= 60000) {
    requestCount = 0;
    lastResetTime = now;
  }
  
  // Check rate limit (60 requests per minute)
  if (requestCount >= 60) {
    const waitTime = 60000 - (now - lastResetTime);
    if (waitTime > 0) {
      console.log(`⏳ [YC] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      requestCount = 0;
      lastResetTime = Date.now();
    }
  }
  
  // Minimum 100ms between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 100) {
    await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  requestCount++;
}

// === HELPERS ===
function sanitizeQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  return query
    .replace(/<script.*?>.*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 1000);
}

// === FIXED: Process results with safer URL handling ===
function processYouComResult(result: YouComResult): CategorizedResult {
  const url = result.url || '';
  
  // Validate URL first
  if (!isLikelyValidLegalUrl(url)) {
    console.warn(`⚠️ [YC] Low quality URL detected: ${url}`);
  }
  
  // FIXED: Safer domain extraction - now YouComResult has source_domain property
  let domain = '';
  if (url && url !== '#' && /^https?:\/\//i.test(url)) {
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
      console.warn(`Failed to parse URL: ${url}`);
      // Use source_domain or domain as fallback
      domain = result.source_domain || result.domain || '';
    }
  } else {
    // Use source_domain or domain as fallback
    domain = result.source_domain || result.domain || '';
  }
  
  // Combine all text content - INCREASED to 2000 chars to catch EUR-Lex URLs
  const fullText = [
    result.title || '',
    result.description || '',
    result.snippet || '',
    ...(result.snippets || [])
  ].join(' ').substring(0, 2000);
  
  // Extract laws from the content (now includes EUR-Lex URLs)
  const detectedLaws = extractGreekLaws(fullText);
  
  // Separate EUR-Lex URLs from other laws
  const eurLexLaws = detectedLaws.filter(law => law.startsWith('[EUR-LEX]:'));
  const regularLaws = detectedLaws.filter(law => !law.startsWith('[EUR-LEX]:'));
  
  // Determine category and confidence
  let category: 'legislation' | 'jurisprudence' | 'development' = 'development';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  const lowerText = fullText.toLowerCase();
  
  // Check for legislation indicators
  const hasLawIndicators = 
    regularLaws.length > 0 ||
    /νόμ|διάταγμ|κώδικ|ΦΕΚ|εφημερίδα\s+κυβερν|άρθρ|υπουργ/i.test(fullText) ||
    /GDPR|Regulation|Directive|eur-lex/i.test(fullText);  // EU law indicators
  
  // Check for case law indicators  
  const hasCaseLawIndicators = 
    /απόφαση|αρεόπαγ|εφετεί|πρωτοδικεί|ΣτΕ|δικαστήρ|νομολογ/i.test(fullText) ||
    /ΔΕΕ|CJEU|ECJ|C-\d+\/\d+|T-\d+\/\d+/i.test(fullText);  // EU court indicators
  
  // Categorization logic with law detection priority
// Categorization logic with law detection priority
  if (regularLaws.length > 0 || eurLexLaws.length > 0) {
    const hasCourtDecision = regularLaws.some(law => /ΑΠ|ΣτΕ|Εφ|ΕλΣυν|ΔιοικΕφ|Πρωτ/i.test(law));
    const hasEUCourt = eurLexLaws.some(law => law.includes('curia.europa.eu'));
    
    if (hasCourtDecision || hasEUCourt) {
      category = 'jurisprudence';
      // Keep EXISTING confidence, don't auto-upgrade
    } else {
      category = 'legislation';
      confidence = 'high';
    }
  } else if (hasLawIndicators) {
    category = 'legislation';
    confidence = LEGAL_DOMAINS.HIGH.some(d => domain.includes(d)) ? 'high' :
               LEGAL_DOMAINS.MEDIUM.some(d => domain.includes(d)) ? 'medium' : 'low';
  } else if (hasCaseLawIndicators) {
    category = 'jurisprudence';
    confidence = LEGAL_DOMAINS.HIGH.some(d => domain.includes(d)) ? 'high' : 'medium';
  } else if (LEGAL_DOMAINS.HIGH.some(d => domain.includes(d))) {
    category = 'legislation';
    confidence = 'medium';
  } else if (LEGAL_DOMAINS.MEDIUM.some(d => domain.includes(d))) {
    category = 'development';
    confidence = 'medium';
  }
  
  // Boost confidence if EUR-Lex URLs found
  if (eurLexLaws.length > 0 && confidence === 'low') {
    confidence = 'medium';
  }
  
  // Reduce confidence for potentially invalid URLs
  if (!isLikelyValidLegalUrl(url)) {
    confidence = 'low';
  }
  
  // Add source_domain field with fallback
  const resultDomain = domain || 'unknown';
  
  return {
    title: result.title || 'Untitled',
    url: url,  // Keep original URL
    preview_text: result.description || result.snippet || (result.snippets ? result.snippets.join(' ') : ''),
    source_domain: resultDomain,
    publication_date: result.age,
    confidence,
    category,
    // Store all detected laws (including EUR-Lex)
    detected_laws: detectedLaws.length > 0 ? detectedLaws : undefined,
    law_confidence: detectedLaws.length > 0 ? Math.min(1.0, detectedLaws.length * 0.33) : 0
  };
}

function createEmptyResults(query: string, error?: string): StructuredPerplexityResults {
  return {
    legislation: [],
    jurisprudence: [],
    developments: [],
    metadata: {
      totalResults: 0,
      searchQuery: query,
      timestamp: new Date().toISOString(),
      error
    },
    success: false
  };
}

// === MAIN SEARCH FUNCTION with typed context ===
async function performSearch(query: string, context?: SearchContext): Promise<StructuredPerplexityResults> {
  console.log('🌐 [YC] Starting You.com search with query:', query.substring(0, 50) + '...');
  
  // Use the alternative key if main CONFIG.API_KEY doesn't work
  const apiKey = CONFIG.API_KEY || ALTERNATIVE_API_KEY;
  
  // Log API configuration (mask the middle part of the key)
  console.log('🔑 [YC] API Key configured:', !!apiKey);
  if (apiKey) {
    const keyLength = apiKey.length;
    const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(keyLength - 10);
    console.log('🔑 [YC] API Key (masked):', maskedKey);
    console.log('🔑 [YC] API Key length:', keyLength);
  }
  
  // Enhance query for EU laws
  const enhancedQuery = enhanceQueryForEULaws(query);
  const searchQuery = enhancedQuery;
  
  if (searchQuery !== query) {
    console.log('🇪🇺 [YC] EU law detected, enhanced query:', searchQuery.substring(0, 150));
  } else {
    console.log('📝 [YC] Using original query:', searchQuery.substring(0, 100));
  }
  
  const headers = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 [YC] Attempt ${attempt + 1} of ${CONFIG.MAX_RETRIES + 1}`);
      
      await rateLimit();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
      
      // Query parameters - Use only known working parameters
      const params = new URLSearchParams({
        query: searchQuery,  // Use enhanced query
        num_web_results: String(CONFIG.MAX_RESULTS)  // Number of results
      });
      
      const fullUrl = `${CONFIG.API_URL}?${params.toString()}`;
      console.log('🌐 [YC] Full URL:', fullUrl);
      
      console.log('⏳ [YC] Making fetch request...');
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📊 [YC] Response Status: ${response.status}`);
      console.log(`📊 [YC] Response Status Text: ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ [YC] Error response:', errorText);
        
        if (response.status === 402) {
          console.error('💳 [YC] 402 Payment Required - Check your subscription/credits');
          throw new Error('You.com API error: 402 - Payment required or credits exhausted');
        } else if (response.status === 403) {
          console.error('🚫 [YC] 403 Forbidden - API key is invalid');
          throw new Error('You.com API error: 403 - Invalid API key');
        } else if (response.status === 429) {
          console.error('⏰ [YC] 429 Rate limit exceeded');
          throw new Error('Rate limit exceeded');
        } else if (response.status === 400) {
          console.error('❌ [YC] 400 Bad Request - Check query parameters');
          throw new Error(`You.com API error: 400 - ${errorText}`);
        } else {
          throw new Error(`You.com API error: ${response.status} - ${errorText}`);
        }
      }
      
      console.log('📥 [YC] Parsing JSON response...');
      const responseText = await response.text();
      console.log('📥 [YC] Raw response (first 500 chars):', responseText.substring(0, 500));
      
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ [YC] Failed to parse JSON:', e);
        console.error('❌ [YC] Response was:', responseText);
        throw new Error('Invalid JSON response from You.com API');
      }
      
      // Handle both 'hits' and 'results' based on API response
      const results = data.hits || data.results || [];
      
      console.log('📦 [YC] Response has hits/results:', !!results);
      console.log('📦 [YC] Number of results:', results.length);
      
      if (data.error) {
        console.error('⚠️ [YC] API returned error:', data.error);
        throw new Error(`You.com API error: ${data.error}`);
      }
      
      if (!Array.isArray(results) || results.length === 0) {
        console.warn('⚠️ [YC] No results returned from You.com');
        return createEmptyResults(query, 'No results found');
      }
      
      // Map the results to match expected format
      console.log('🔗 [YC] Processing URLs from API...');
      const mappedResults: YouComResult[] = results.map((hit: any, index: number) => {
        const url = hit.url || '';
        if (index < 5) { // Log first 5 URLs
          console.log(`  ${index + 1}. ${url || 'NO URL'}`);
        }
        return {
          url: url,
          title: hit.title || hit.name || 'Untitled',
          description: hit.description || hit.snippet || '',
          snippet: hit.snippet || hit.description || '',
          snippets: hit.snippets || [hit.snippet || hit.description || ''],
          age: hit.age || hit.published_date || '',
          source_domain: hit.source_domain || hit.domain || '',
          domain: hit.domain || hit.source_domain || ''
        };
      });
      
      // Filter out invalid URLs before processing
      const validResults = mappedResults.filter(result => {
        const isValid = isLikelyValidLegalUrl(result.url);
        if (!isValid) {
          console.log(`🚫 [YC] Filtering out invalid URL: ${result.url}`);
        }
        return isValid;
      });
      
      console.log(`✅ [YC] Valid results after filtering: ${validResults.length}/${mappedResults.length}`);
      
      // Process results with law detection (now includes EUR-Lex)
      const processedResults = validResults.map(processYouComResult);
      
      // Collect all detected laws and EUR-Lex URLs for metadata
      const allDetectedLaws = new Set<string>();
      const eurLexUrls = new Set<string>();
      
      processedResults.forEach(result => {
        if (result.detected_laws) {
          result.detected_laws.forEach(law => {
            if (law.startsWith('[EUR-LEX]:')) {
              eurLexUrls.add(law.replace('[EUR-LEX]: ', ''));
            } else {
              allDetectedLaws.add(law);
            }
          });
        }
      });
      
      // FIXED: Sort results with cleaner comparison logic
      processedResults.sort((a, b) => {
        // Prioritize results with EUR-Lex URLs
        const aHasEurLex = a.detected_laws?.some(law => law.startsWith('[EUR-LEX]:')) ? 1 : 0;
        const bHasEurLex = b.detected_laws?.some(law => law.startsWith('[EUR-LEX]:')) ? 1 : 0;
        
        if (aHasEurLex !== bHasEurLex) return bHasEurLex - aHasEurLex;
        
        // Then check for any laws
        const aHasLaws = (a.detected_laws?.length || 0) > 0 ? 1 : 0;
        const bHasLaws = (b.detected_laws?.length || 0) > 0 ? 1 : 0;
        
        if (aHasLaws !== bHasLaws) return bHasLaws - aHasLaws;
        
        // Second priority: confidence level
        const confOrder: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };
        const aConf = confOrder[a.confidence] || 0;
        const bConf = confOrder[b.confidence] || 0;
        
        if (aConf !== bConf) return bConf - aConf;
        
        // Third priority: category
        const catOrder: Record<string, number> = { 'legislation': 3, 'jurisprudence': 2, 'development': 1 };
        const aCat = catOrder[a.category] || 0;
        const bCat = catOrder[b.category] || 0;
        
        return bCat - aCat;
      });
      
      // FIXED: Build properly typed metadata object
      const metadata: StructuredPerplexityResults['metadata'] = {
        totalResults: processedResults.length,
        searchQuery: query,
        timestamp: new Date().toISOString(),
        detected_laws_summary: Array.from(allDetectedLaws),
        ...(eurLexUrls.size > 0 && { eurlex_urls_found: Array.from(eurLexUrls) })
      };
      
      // Categorize ALL results without limiting
      const structuredResults: StructuredPerplexityResults = {
        legislation: processedResults.filter(r => r.category === 'legislation'),
        jurisprudence: processedResults.filter(r => r.category === 'jurisprudence'),
        developments: processedResults.filter(r => r.category === 'development'),
        metadata,
        success: true
      };
      
      console.log(`✅ [YC] Successfully processed ${processedResults.length} results`);
      console.log(`📚 [YC] Detected laws:`, Array.from(allDetectedLaws).slice(0, 5));
      
      // FIXED: Safe logging with null check
      if (metadata.eurlex_urls_found && metadata.eurlex_urls_found.length > 0) {
        console.log(`🇪🇺 [YC] Found ${metadata.eurlex_urls_found.length} EUR-Lex URLs:`, metadata.eurlex_urls_found.slice(0, 3));
      }
      
      console.log(`✅ [YC] Results breakdown: ${structuredResults.legislation.length} legislation, ${structuredResults.jurisprudence.length} jurisprudence, ${structuredResults.developments.length} developments`);
      console.log(`✅ [YC] Total results returned: ${structuredResults.legislation.length + structuredResults.jurisprudence.length + structuredResults.developments.length}`);
      
      return structuredResults;
      
    } catch (error: any) {
      lastError = error;
      
      console.error(`❌ [YC] Attempt ${attempt + 1} failed:`, error.message);
      console.error(`❌ [YC] Error type:`, error.name);
      
      if (error.message && (error.message.includes('403') || error.message.includes('Invalid API key') || error.message.includes('402'))) {
        console.error('🔑 [YC] Authentication/Payment issue - not retrying');
        break;
      }
      
      if (error.name === 'AbortError') {
        console.error('⏱️ [YC] Request timed out after', CONFIG.TIMEOUT, 'ms');
      }
      
      if (attempt < CONFIG.MAX_RETRIES) {
        const delay = 1000 * (attempt + 1);
        console.log(`⏳ [YC] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  const errorMessage = lastError ? lastError.message : 'Unknown error';
  console.error('💥 [YC] All attempts failed. Final error:', errorMessage);
  return createEmptyResults(query, errorMessage);
}

// === MAIN EXPORT with typed context ===
export async function searchYouComForLegal(
  query: string,
  userContext?: SearchContext
): Promise<StructuredPerplexityResults> {
  if (!query || !query.trim()) {
    return createEmptyResults(query, 'Search query cannot be empty');
  }
  
  const apiKey = CONFIG.API_KEY || ALTERNATIVE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ You.com API key not configured');
    console.error('Set YOUCOM_API_KEY or You_com_api in your .env file');
    return createEmptyResults(query, 'You.com API key not configured');
  }
  
  // Check cache
  const cacheKey = query;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`✅ [YC] Cache hit for: "${query.substring(0, 50)}..."`);
    return cached;
  }
  
  try {
    const sanitized = sanitizeQuery(query);
    // Pass context but don't use it to modify query (enhancement happens inside performSearch)
    const results = await performSearch(sanitized, userContext);
    
    if (results.success) {
      setCache(cacheKey, results);
    }
    
    return results;
    
  } catch (error: any) {
    console.error('❌ [YC] You.com search failed:', error.message || error);
    return createEmptyResults(query, error.message || 'Search failed');
  }
}

// === TEST CONNECTION FUNCTION ===
export async function testYouComConnection(): Promise<{
  success: boolean;
  message: string;
  apiKeyLength?: number;
  apiKeyPreview?: string;
}> {
  const apiKey = CONFIG.API_KEY || ALTERNATIVE_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      message: 'API key not configured'
    };
  }
  
  try {
    console.log('🧪 Testing You.com connection...');
    const testQuery = 'νόμος 4412 δημόσιες συμβάσεις'; // Greek legal test query
    
    const params = new URLSearchParams({
      query: testQuery,
      num_web_results: '1'
    });
    
    const response = await fetch(`${CONFIG.API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'Connection successful',
        apiKeyLength: apiKey.length,
        apiKeyPreview: apiKey.substring(0, 20) + '...'
      };
    } else {
      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`,
        apiKeyLength: apiKey.length,
        apiKeyPreview: apiKey.substring(0, 20) + '...'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Connection error: ${error.message}`,
      apiKeyLength: apiKey.length,
      apiKeyPreview: apiKey.substring(0, 20) + '...'
    };
  }
}

// === UTILITIES ===
export function clearYouComCache(): void {
  cache.clear();
  console.log('You.com cache cleared');
}

export function getYouComStatus() {
  const apiKey = CONFIG.API_KEY || ALTERNATIVE_API_KEY;
  return {
    configured: !!apiKey,
    rateLimit: 60,
    cacheEnabled: true,
    apiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0
  };
}

// Circuit breaker for compatibility with existing code
export const youComCircuitBreaker = {
  recordTimeout: () => {
    console.log('Timeout recorded');
  },
  isOpen: () => false,
  getStatus: () => ({ 
    isOpen: false, 
    openUntil: 0,
    status: 'CLOSED' 
  })
};

// Initialize
const apiKey = CONFIG.API_KEY || ALTERNATIVE_API_KEY;
if (!apiKey) {
  console.warn('⚠️ You.com API key not configured - set YOUCOM_API_KEY or You_com_api in .env');
} else {
  console.log('✅ You.com API configured with law detection and EUR-Lex support');
  console.log('🔑 API key length:', apiKey.length);
  console.log('📚 Law detection patterns loaded');
  console.log('🇪🇺 EUR-Lex URL extraction enabled');
}

// Named export for ESLint
const youComSearchUtils = { 
  searchYouComForLegal, 
  clearYouComCache, 
  getYouComStatus,
  youComCircuitBreaker,
  testYouComConnection,
  extractGreekLaws,  // Export for testing purposes
  extractEurLexUrls,  // Export for EUR-Lex extraction
  enhanceQueryForEULaws  // Export for query enhancement
};

export default youComSearchUtils;
