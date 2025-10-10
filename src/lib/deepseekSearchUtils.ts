import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// === SHARED INTERFACES ===
// These should be imported from a shared types file or the Perplexity module 
// For now, defining them here to avoid import issues 
interface CategorizedResult {
  title: string;
  url: string;
  preview_text: string;
  source_domain: string;
  publication_date?: string;
  confidence: 'high' | 'medium' | 'low';
  category: 'legislation' | 'jurisprudence' | 'development';
}

interface StructuredPerplexityResults {
  legislation: CategorizedResult[];
  jurisprudence: CategorizedResult[];
  developments: CategorizedResult[];
  metadata: {
    totalResults: number;
    searchQuery: string;
    timestamp: string;
  };
  success: boolean;
}

// === DEEPSEEK TYPES ===
interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface SourceUrlInfo {
  reference: string;
  url: string;
  source_domain: string;
  source_type: 'official' | 'judicial' | 'academic' | 'news' | 'professional';
  confidence: 'high' | 'medium' | 'low';
}

interface InternalDeepSeekResult {
  title: string;
  content: string;
  category: 'laws' | 'cases' | 'news' | 'legal_analysis';
  confidence: 'high' | 'medium' | 'low';
  relevance_score: number;
  law_references: string[];
  case_references: string[];
  news_sources: string[];
  strategy?: string;
  source_priority: 'high' | 'medium' | 'low';
  source_domain: string;
  source_url: string;
  is_authoritative: boolean;
  source_urls: {
    law_references: SourceUrlInfo[];
    case_references: SourceUrlInfo[];
    news_sources: SourceUrlInfo[];
  };
}

interface ProcessedContext {
  enhancedQuery: string;
  contextInfo: string;
}

// === CONFIGURATION ===
const DEEPSEEK_CONFIG = {
  API_KEY: process.env.DEEPSEEK_API_KEY || '',
  API_URL: 'https://api.deepseek.com/v1/chat/completions',
  MODEL: 'deepseek-chat',
  TIMEOUT: 35000,
  MAX_TOKENS: 2000,
  TEMPERATURE: 0.3,
  MAX_RETRIES: 1,
  RETRY_DELAY_BASE: 500,
  RATE_LIMIT_PER_MINUTE: 60,
  MIN_REQUEST_INTERVAL: 100,
  CACHE_ENABLED: true,
  CACHE_TTL: 1800000, // 30 minutes
};

// === GREEK LEGAL SOURCE MAPPINGS ===
const GREEK_LEGAL_AUTHORITIES = {
  HIGH_PRIORITY: [
    'hellenicparliament.gr',
    'areiospagos.gr',
    'ste.gr',
    'dsa.gr',
    'aaade.gr',
    'government.gov.gr',
    'et.gr',
    'eur-lex.europa.eu',
    'curia.europa.eu'
  ],
  MEDIUM_PRIORITY: [
    'lawspot.gr',
    'ethemis.gr',
    'nomosphysis.gr',
    'dikigorika-nea.gr',
    'legalupdates.gr'
  ]
};

const GREEK_LEGAL_SOURCE_URLS: Record<string, { url: string; type: string }> = {
  'hellenicparliament.gr': { url: 'https://www.hellenicparliament.gr/', type: 'official' },
  'government.gov.gr': { url: 'https://www.gov.gr/', type: 'official' },
  'et.gr': { url: 'https://www.et.gr/', type: 'official' },
  'dsa.gr': { url: 'https://www.dsa.gr/', type: 'official' },
  'aaade.gr': { url: 'https://www.aaade.gr/', type: 'official' },
  'areiospagos.gr': { url: 'https://www.areiospagos.gr/', type: 'judicial' },
  'ste.gr': { url: 'https://www.ste.gr/', type: 'judicial' },
  'eur-lex.europa.eu': { url: 'https://eur-lex.europa.eu/', type: 'official' },
  'curia.europa.eu': { url: 'https://curia.europa.eu/', type: 'judicial' },
  'lawspot.gr': { url: 'https://www.lawspot.gr/', type: 'news' },
  'ethemis.gr': { url: 'https://www.ethemis.gr/', type: 'news' }
};

// === URL MAPPING FUNCTIONS ===
function mapLegalReferenceToUrl(reference: string): SourceUrlInfo {
  // Default fallback
  const defaultResult: SourceUrlInfo = {
    reference,
    url: `https://www.google.com/?q=${encodeURIComponent(reference + ' νομική πηγή')}`,
    source_domain: 'google.com',
    source_type: 'news',
    confidence: 'low'
  };

  try {
    // Law references (N. 1234/2024)
    const lawMatch = reference.match(/[Νν]\.\s*(\d+)\/(\d{4})/);
    if (lawMatch) {
      return {
        reference,
        url: `https://www.hellenicparliament.gr/Nomothetiko-Ergo/Nomothetiko-Apotelesma?lawNumber=${lawMatch[1]}&year=${lawMatch[2]}`,
        source_domain: 'hellenicparliament.gr',
        source_type: 'official',
        confidence: 'high'
      };
    }

    // Presidential Decrees (ΠΔ 123/2024)
    if (reference.match(/ΠΔ\s*\d+\/\d{4}/i)) {
      return {
        reference,
        url: `https://www.et.gr//?q=${encodeURIComponent(reference)}`,
        source_domain: 'et.gr',
        source_type: 'official',
        confidence: 'medium'
      };
    }

    // Supreme Court decisions (ΑΠ 123/2023)
    if (reference.match(/ΑΠ\s*\d+\/\d{4}/i)) {
      return {
        reference,
        url: 'https://www.areiospagos.gr/apofaseis/',
        source_domain: 'areiospagos.gr',
        source_type: 'judicial',
        confidence: 'high'
      };
    }

    // Council of State decisions (ΣτΕ 456/2022)
    if (reference.match(/ΣτΕ\s*\d+\/\d{4}/i)) {
      return {
        reference,
        url: 'https://www.ste.gr/apofaseis/',
        source_domain: 'ste.gr',
        source_type: 'judicial',
        confidence: 'high'
      };
    }

    // European directives
    if (reference.match(/οδηγία\s*\d+\/\d+/i) || reference.match(/directive\s*\d+\/\d+/i)) {
      return {
        reference,
        url: `https://eur-lex.europa.eu/search.html?q=${encodeURIComponent(reference)}`,
        source_domain: 'eur-lex.europa.eu',
        source_type: 'official',
        confidence: 'high'
      };
    }

    return defaultResult;
  } catch (error) {
    console.warn(`Error mapping legal reference "${reference}":`, error);
    return defaultResult;
  }
}

function mapNewsSourceToUrl(source: string): SourceUrlInfo {
  const defaultResult: SourceUrlInfo = {
    reference: source,
    url: `https://www.google.com/search?q=${encodeURIComponent(source + ' νομική πηγή')}`,
    source_domain: 'google.com',
    source_type: 'news',
    confidence: 'low'
  };

  const sourceMap: Record<string, { url: string; type: 'official' | 'professional' | 'news' }> = {
    'νομικό συνέδριο': { url: 'https://www.nomikosynedrio.gr/', type: 'professional' },
    'δικηγορικός σύλλογος': { url: 'https://www.dsa.gr/', type: 'professional' },
    'υπουργείο δικαιοσύνης': { url: 'https://justice.gov.gr/', type: 'official' },
    'δσα': { url: 'https://www.dsa.gr/', type: 'professional' },
    'εφκα': { url: 'https://www.efka.gov.gr/', type: 'official' },
    'ααδε': { url: 'https://www.aade.gr/', type: 'official' }
  };

  try {
    const sourceLower = source.toLowerCase();
    const matchedEntry = Object.entries(sourceMap).find(([key]) => 
      sourceLower.includes(key)
    );

    if (matchedEntry) {
      const [, sourceInfo] = matchedEntry;
      const url = new URL(sourceInfo.url);
      return {
        reference: source,
        url: sourceInfo.url,
        source_domain: url.hostname,
        source_type: sourceInfo.type,
        confidence: 'high'
      };
    }

    return defaultResult;
  } catch (error) {
    console.warn(`Error mapping news source "${source}":`, error);
    return defaultResult;
  }
}

// === UTILITY FUNCTIONS ===
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function validateConfig(): void {
  if (!DEEPSEEK_CONFIG.API_KEY) {
    console.warn('DeepSeek API key not configured - service will be unavailable');
  }
}

function validateAndSanitizeQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  let sanitized = query
    .replace(/<script.*?>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<\/?\w+.*?>/gi, '')
    .trim();
  
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  if (sanitized.length < 3) {
    throw new Error('Query must be at least 3 characters long');
  }
  
  return sanitized;
}

validateConfig();

function validateResponseRelevance(
  apiResponse: any,
  userQuery: string,
  queryIntent?: {
    legalCategories?: string[];
    detectedLaws?: string[];
    keywords?: string[];
  }
): { isRelevant: boolean; score: number } {
  
  const stopWords = new Set([
    'το', 'τα', 'τη', 'την', 'του', 'των', 'τις', 'τους',
    'και', 'ή', 'με', 'σε', 'για', 'από', 'στο', 'στη',
    'the', 'a', 'an', 'and', 'or', 'with', 'for', 'from',
    'είναι', 'έχει', 'έχω', 'μπορώ', 'θέλω', 'is', 'has', 'can'
  ]);
  
  const words = userQuery.toLowerCase().split(/\s+/);
  const queryTerms: string[] = [];
  
  words.forEach(word => {
    if (word.length > 2 && !stopWords.has(word)) {
      queryTerms.push(word);
    }
  });
  
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
      queryTerms.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  const texts: string[] = [];
  if (apiResponse.legislation) {
    texts.push(...apiResponse.legislation.map((item: any) => 
      `${item.title || ''} ${item.preview_text || ''} ${item.description || ''}`
    ));
  }
  if (apiResponse.jurisprudence) {
    texts.push(...apiResponse.jurisprudence.map((item: any) => 
      `${item.title || ''} ${item.preview_text || ''} ${item.description || ''}`
    ));
  }
  if (apiResponse.developments) {
    texts.push(...apiResponse.developments.map((item: any) => 
      `${item.title || ''} ${item.preview_text || ''} ${item.description || ''}`
    ));
  }
  
  const responseText = texts.join(' ').toLowerCase();
  
  let matchedTerms = 0;
  for (const term of queryTerms.slice(0, 15)) {
    if (responseText.includes(term)) {
      matchedTerms++;
    }
  }
  
  const score = queryTerms.length > 0 
    ? Math.min((matchedTerms / Math.max(queryTerms.length * 0.3, 1)) * 100, 100)
    : 50;
    
  return {
    isRelevant: score >= 40,
    score: Math.round(score)
  };
}


// === RATE LIMITER ===
class DeepSeekRateLimiter {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private resetTime: number = Date.now();
  private circuitBreakerFailures: number = 0;
  private circuitBreakerOpenUntil: number = 0;

  isCircuitBreakerOpen(): boolean {
      return this.circuitBreakerOpenUntil > Date.now();
    }
    
    // ADD THIS PUBLIC METHOD to get circuit breaker details
    getCircuitBreakerStatus(): { isOpen: boolean; openUntil: number; failures: number } {
      return {
        isOpen: this.circuitBreakerOpenUntil > Date.now(),
        openUntil: this.circuitBreakerOpenUntil,
        failures: this.circuitBreakerFailures
      };
    }
  
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    if (this.circuitBreakerOpenUntil > now) {
      throw new Error(`Circuit breaker open until ${new Date(this.circuitBreakerOpenUntil).toISOString()}`);
    }
    
    if (now - this.resetTime > 60000) {
      this.requestCount = 0;
      this.resetTime = now;
    }
    
    if (this.requestCount >= DEEPSEEK_CONFIG.RATE_LIMIT_PER_MINUTE) {
      const waitTime = 60000 - (now - this.resetTime) + 10;
      if (waitTime > 0) {
        console.log(`DeepSeek rate limit: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.resetTime = Date.now();
      }
    }
    
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < DEEPSEEK_CONFIG.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, DEEPSEEK_CONFIG.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
  
  recordSuccess(): void {
    this.circuitBreakerFailures = 0;
  }
  
  recordError(): void {
    this.circuitBreakerFailures++;
    
    if (this.circuitBreakerFailures >= 5) {
      this.circuitBreakerOpenUntil = Date.now() + 60000;
      console.error('Circuit breaker opened due to consecutive failures');
    }
  }
}

// === RESPONSE CACHE ===
class ResponseCache {
  private cache = new Map<string, { data: StructuredPerplexityResults; timestamp: number }>();
  
  get(key: string): StructuredPerplexityResults | null {
    if (!DEEPSEEK_CONFIG.CACHE_ENABLED) return null;
    
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > DEEPSEEK_CONFIG.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return { ...cached.data };
  }
  
  set(key: string, data: StructuredPerplexityResults): void {
    if (!DEEPSEEK_CONFIG.CACHE_ENABLED) return;
    
    this.cache.set(key, {
      data: { ...data },
      timestamp: Date.now()
    });
    
    if (this.cache.size > 100) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (let i = 0; i < 20; i++) {
        this.cache.delete(sortedEntries[i][0]);
      }
    }
  }
}

// === GLOBAL INSTANCES ===
const deepSeekRateLimiter = new DeepSeekRateLimiter();
const responseCache = new ResponseCache();

export const deepSeekCircuitBreaker = {
  recordTimeout: () => {
    deepSeekRateLimiter.recordError();
  },
  isOpen: (): boolean => {
    return deepSeekRateLimiter.isCircuitBreakerOpen(); // Use the new public method
  },
  getStatus: () => {
    const status = deepSeekRateLimiter.getCircuitBreakerStatus(); // Use the new public method
    return {
      isOpen: status.isOpen,
      failures: status.failures,
      openUntil: status.openUntil
    };
  }
};

// === CONTENT PROCESSING ===
function extractLegalReferences(text: string): { laws: string[]; cases: string[]; news_sources: string[] } {
  const laws: string[] = [];
  const cases: string[] = [];
  const news_sources: string[] = [];
  
  const lawPatterns = [
    /[Νν]\.\s*\d+\/\d{4}/g,
    /νόμος\s*\d+\/\d{4}/gi,
    /ΠΔ\s*\d+\/\d{4}/gi,
    /ΥΑ\s*[\w\/]+/gi,
    /ΚΥΑ\s*[\w\/]+/gi
  ];
  
  const casePatterns = [
    /ΑΠ\s*\d+\/\d{4}/gi,
    /ΣτΕ\s*\d+\/\d{4}/gi,
    /ΕλΣυν\s*\d+\/\d{4}/gi,
    /ΕφΑθ\s*\d+\/\d{4}/gi,
    /ΜονΠρωτΑθ\s*\d+\/\d{4}/gi
  ];
  
  const newsPatterns = [
    /Νομικό\s*Συνέδριο/gi,
    /Δικηγορικός\s*Σύλλογος/gi,
    /Υπουργείο\s*Δικαιοσύνης/gi,
    /ΔΣΑ/gi,
    /ΕΦΚΑ/gi,
    /ΑΑΔΕ/gi
  ];
  
  try {
    lawPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        laws.push(...matches);
      }
    });
    
    casePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        cases.push(...matches);
      }
    });
    
    newsPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        news_sources.push(...matches);
      }
    });
  } catch (error) {
    console.warn('Error extracting legal references:', error);
  }
  
  return {
    laws: [...new Set(laws)],
    cases: [...new Set(cases)],
    news_sources: [...new Set(news_sources)]
  };
}

function extractSection(content: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    try {
      const regex = new RegExp(`(${keyword}[\\s\\S]*?)(?=\\n\\d\\.\\s|\\n[Α-Ω]{3,}|$)`, 'i');
      const match = content.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (error) {
      console.warn(`Error extracting section for keyword "${keyword}":`, error);
      continue;
    }
  }
  return null;
}

// NEW HELPER FUNCTIONS - These are SEPARATE functions
function extractUrlsFromSection(sectionContent: string, allUrls: string[]): string[] {
  // Find URLs that appear near or within this section content
  const sectionUrls: string[] = [];
  
  for (const url of allUrls) {
    // Check if URL appears in or near this section
    if (sectionContent.includes(url) || 
        sectionContent.includes(new URL(url).hostname)) {
      sectionUrls.push(url);
    }
  }
  
  return sectionUrls;
}

function mapLawsToUrls(laws: string[], urls: string[]): SourceUrlInfo[] {
  return laws.map(law => {
    // Try to find a matching URL
    const matchingUrl = urls.find(url => 
      url.includes(law.replace(/[\s.]/g, '')) ||
      url.includes('et.gr')
    );
    
    return {
      reference: law,
      url: matchingUrl || `https://www.et.gr/search?q=${encodeURIComponent(law)}`,
      source_domain: matchingUrl ? new URL(matchingUrl).hostname : 'et.gr',
      source_type: 'official',
      confidence: matchingUrl ? 'high' : 'medium'
    };
  });
}

function mapCasesToUrls(cases: string[], urls: string[]): SourceUrlInfo[] {
  return cases.map(caseRef => {
    // Try to find a matching URL
    const matchingUrl = urls.find(url => 
      url.includes(caseRef.replace(/[\s.]/g, '')) ||
      url.includes('adjustice.gr') ||
      url.includes('areiospagos.gr')
    );
    
    return {
      reference: caseRef,
      url: matchingUrl || `https://www.adjustice.gr/search?q=${encodeURIComponent(caseRef)}`,
      source_domain: matchingUrl ? new URL(matchingUrl).hostname : 'adjustice.gr',
      source_type: 'judicial',
      confidence: matchingUrl ? 'high' : 'medium'
    };
  });
}

function mapNewsToUrls(sources: string[], urls: string[]): SourceUrlInfo[] {
  return sources.map(source => {
    // Try to find a matching URL
    const matchingUrl = urls.find(url => 
      url.includes('lawspot') ||
      url.includes('ethemis') ||
      url.includes('news')
    );
    
    return {
      reference: source,
      url: matchingUrl || `https://www.lawspot.gr/search?q=${encodeURIComponent(source)}`,
      source_domain: matchingUrl ? new URL(matchingUrl).hostname : 'lawspot.gr',
      source_type: 'news',
      confidence: matchingUrl ? 'high' : 'low'
    };
  });
}

// This ADDS URL extraction to your existing function
function parseUnifiedResponse(content: string, query: string): any[] {
  const results: any[] = [];
  
  try {
    // NEW: Extract all URLs from the content first
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const foundUrls = content.match(urlRegex) || [];
    
    const sections = {
      laws: extractSection(content, ['ΝΟΜΟΘΕΣΙΑ', 'ΝΟΜΟΙ', 'ΔΙΑΤΑΞΕΙΣ']),
      cases: extractSection(content, ['ΝΟΜΟΛΟΓΙΑ', 'ΑΠΟΦΑΣΕΙΣ', 'ΔΙΚΑΣΤΙΚΕΣ']),
      news: extractSection(content, ['ΕΞΕΛΙΞΕΙΣ', 'ΕΓΚΥΚΛΙΟΙ', 'ΠΡΟΣΦΑΤΑ']),
      analysis: extractSection(content, ['ΔΙΑΒΟΥΛΕΥΣΕΙΣ', 'ΑΝΑΛΥΣΕΙΣ', 'ΣΥΜΠΕΡΑΣΜΑΤΑ'])
    };
    
    if (sections.laws) {
      const references = extractLegalReferences(sections.laws);
      
      // NEW: Extract URLs specific to this section
      const sectionUrls = extractUrlsFromSection(sections.laws, foundUrls);
      
      results.push({
        title: `Νομοθεσία: ${query.substring(0, 40)}...`,
        content: sections.laws,
        category: 'laws',
        confidence: references.laws.length > 0 ? 'high' : 'medium',
        relevance_score: 0.9,
        law_references: references.laws,
        case_references: references.cases,
        news_sources: [],
        strategy: 'unified_laws',
        // NEW: Add source URLs
        source_url: sectionUrls[0] || 'https://www.et.gr/',
        source_urls: {
          law_references: mapLawsToUrls(references.laws, sectionUrls),
          case_references: [],
          news_sources: []
        }
      });
    }
    
    if (sections.cases) {
      const references = extractLegalReferences(sections.cases);
      
      // NEW: Extract URLs specific to this section
      const sectionUrls = extractUrlsFromSection(sections.cases, foundUrls);
      
      results.push({
        title: `Νομολογία: ${query.substring(0, 40)}...`,
        content: sections.cases,
        category: 'cases',
        confidence: references.cases.length > 0 ? 'high' : 'medium',
        relevance_score: 0.8,
        case_references: references.cases,
        law_references: references.laws,
        news_sources: [],
        strategy: 'unified_cases',
        // NEW: Add source URLs
        source_url: sectionUrls[0] || 'https://www.adjustice.gr/',
        source_urls: {
          law_references: [],
          case_references: mapCasesToUrls(references.cases, sectionUrls),
          news_sources: []
        }
      });
    }
    
    if (sections.news || sections.analysis) {
      const newsContent = sections.news || sections.analysis || '';
      const references = extractLegalReferences(newsContent);
      
      // NEW: Extract URLs specific to this section
      const sectionUrls = extractUrlsFromSection(newsContent, foundUrls);
      
      results.push({
        title: `Πρόσφατες Εξελίξεις: ${query.substring(0, 40)}...`,
        content: newsContent,
        category: 'news',
        confidence: references.news_sources.length > 0 ? 'high' : 'medium',
        relevance_score: 0.7,
        news_sources: references.news_sources,
        law_references: references.laws,
        case_references: references.cases,
        strategy: 'unified_news',
        // NEW: Add source URLs
        source_url: sectionUrls[0] || 'https://www.lawspot.gr/',
        source_urls: {
          law_references: [],
          case_references: [],
          news_sources: mapNewsToUrls(references.news_sources, sectionUrls)
        }
      });
    }
    
    // Fallback: create comprehensive result if no sections found
    if (results.length === 0) {
      const references = extractLegalReferences(content);
      results.push({
        title: `Ολοκληρωμένη Ανάλυση: ${query}`,
        content: content,
        category: 'legal_analysis',
        confidence: 'high',
        relevance_score: 1.0,
        law_references: references.laws,
        case_references: references.cases,
        news_sources: references.news_sources,
        strategy: 'unified_comprehensive',
        // NEW: Add fallback URLs
        source_url: 'https://www.et.gr/',
        source_urls: {
          law_references: mapLawsToUrls(references.laws, foundUrls),
          case_references: mapCasesToUrls(references.cases, foundUrls),
          news_sources: mapNewsToUrls(references.news_sources, foundUrls)
        }
      });
    }
  } catch (error) {
    console.error('Error parsing unified response:', error);
    // Return a fallback result even if parsing fails
    results.push({
      title: `Ανάλυση: ${query}`,
      content: content.substring(0, 500) + '...',
      category: 'legal_analysis',
      confidence: 'medium',
      relevance_score: 0.5,
      law_references: [],
      case_references: [],
      news_sources: [],
      strategy: 'fallback',
      // NEW: Add fallback URLs
      source_url: 'https://www.google.com/search?q=' + encodeURIComponent(query),
      source_urls: {
        law_references: [],
        case_references: [],
        news_sources: []
      }
    });
  }
  
  return results;
}

// === SOURCE ANALYSIS ===
function scoreSourcePriority(content: string): {
  priority: 'high' | 'medium' | 'low';
  domain: string;
  url: string;
  source_type: string;
} {
  const contentLower = content.toLowerCase();

  for (const domain of GREEK_LEGAL_AUTHORITIES.HIGH_PRIORITY) {
    if (contentLower.includes(domain)) {
      const sourceInfo = GREEK_LEGAL_SOURCE_URLS[domain];
      return {
        priority: 'high',
        domain,
        url: sourceInfo?.url || `https://${domain}/`,
        source_type: sourceInfo?.type || 'official'
      };
    }
  }

  for (const domain of GREEK_LEGAL_AUTHORITIES.MEDIUM_PRIORITY) {
    if (contentLower.includes(domain)) {
      const sourceInfo = GREEK_LEGAL_SOURCE_URLS[domain];
      return {
        priority: 'medium',
        domain,
        url: sourceInfo?.url || `https://${domain}/`,
        source_type: sourceInfo?.type || 'news'
      };
    }
  }

  return { 
    priority: 'low', 
    domain: 'deepseek.ai',
    url: 'https://deepseek.ai/',
    source_type: 'academic'
  };
}

function enhanceDeepSeekResults(results: any[]): InternalDeepSeekResult[] {
  return results.map(result => {
    const sourceInfo = scoreSourcePriority(result.content);
    
    const enhanced: InternalDeepSeekResult = {
      title: result.title || 'Untitled',
      content: result.content || '',
      category: result.category || 'legal_analysis',
      confidence: result.confidence || 'medium',
      relevance_score: result.relevance_score || 0.5,
      law_references: result.law_references || [],
      case_references: result.case_references || [],
      news_sources: result.news_sources || [],
      strategy: result.strategy,
      source_priority: sourceInfo.priority,
      source_url: result.source_url || sourceInfo.url,
      source_domain: result.source_domain || sourceInfo.domain,
      is_authoritative: sourceInfo.priority !== 'low',
      source_urls: result.source_urls || {
        law_references: [],
        case_references: [],
        news_sources: []
      }
    };

    // Map references to URLs
    try {
      if (enhanced.law_references.length > 0) {
        enhanced.source_urls.law_references = enhanced.law_references.map(ref => 
          mapLegalReferenceToUrl(ref)
        );
      }

      if (enhanced.case_references.length > 0) {
        enhanced.source_urls.case_references = enhanced.case_references.map(ref => 
          mapLegalReferenceToUrl(ref)
        );
      }

      if (enhanced.news_sources.length > 0) {
        enhanced.source_urls.news_sources = enhanced.news_sources.map(source => 
          mapNewsSourceToUrl(source)
        );
      }

      // Boost relevance for authoritative sources
      if (enhanced.is_authoritative) {
        enhanced.relevance_score = Math.min(1.0, enhanced.relevance_score + 0.1);
      }
    } catch (error) {
      console.warn('Error enhancing result URLs:', error);
    }

    return enhanced;
  });
}

// === FORMAT TRANSFORMATION ===
function createPlaceholderResult(category: 'legislation' | 'jurisprudence' | 'development', index: number): CategorizedResult {
  const titles = {
    legislation: `Νομοθετική πηγή ${index}`,
    jurisprudence: `Δικαστική απόφαση ${index}`,
    development: `Πρόσφατη εξέλιξη ${index}`
  };

  const previews = {
    legislation: 'Δεν βρέθηκαν επιπλέον νομοθετικές πηγές για το συγκεκριμένο ερώτημα.',
    jurisprudence: 'Δεν βρέθηκαν επιπλέον δικαστικές αποφάσεις για το συγκεκριμένο ερώτημα.',
    development: 'Δεν βρέθηκαν επιπλέον πρόσφατες εξελίξεις για το συγκεκριμένο ερώτημα.'
  };

  return {
    title: titles[category],
    url: '#',
    preview_text: previews[category],
    source_domain: 'placeholder',
    confidence: 'low',
    category
  };
}

function mapDeepSeekCategoryToPerplexity(category: string): 'legislation' | 'jurisprudence' | 'development' {
  switch (category) {
    case 'laws':
      return 'legislation';
    case 'cases':
      return 'jurisprudence';
    case 'news':
    case 'legal_analysis':
    default:
      return 'development';
  }
}

function transformToPerplexityFormat(results: InternalDeepSeekResult[]): StructuredPerplexityResults {
  const legislation: CategorizedResult[] = [];
  const jurisprudence: CategorizedResult[] = [];
  const developments: CategorizedResult[] = [];

  for (const result of results) {
    const categorizedResult: CategorizedResult = {
      title: result.title,
      url: result.source_url || '#',
      preview_text: result.content.substring(0, 200) + '...',
      source_domain: result.source_domain || 'deepseek.ai',
      publication_date: new Date().toISOString().split('T')[0],
      confidence: result.confidence,
      category: mapDeepSeekCategoryToPerplexity(result.category)
    };

    // Add to appropriate category
    switch (categorizedResult.category) {
      case 'legislation':
        if (legislation.length < 4) legislation.push(categorizedResult);
        break;
      case 'jurisprudence':
        if (jurisprudence.length < 3) jurisprudence.push(categorizedResult);
        break;
      case 'development':
        if (developments.length < 3) developments.push(categorizedResult);
        break;
    }
  }

  // Fill remaining slots with placeholders
  while (legislation.length < 4) {
    legislation.push(createPlaceholderResult('legislation', legislation.length + 1));
  }
  while (jurisprudence.length < 3) {
    jurisprudence.push(createPlaceholderResult('jurisprudence', jurisprudence.length + 1));
  }
  while (developments.length < 3) {
    developments.push(createPlaceholderResult('development', developments.length + 1));
  }

  return {
    legislation: legislation.slice(0, 4),
    jurisprudence: jurisprudence.slice(0, 3),
    developments: developments.slice(0, 3),
    metadata: {
      totalResults: results.length,
      searchQuery: '',
      timestamp: new Date().toISOString()
    },
    success: results.length > 0
  };
}

// === CONTEXT PROCESSING ===
function processEnhancedContext(userContext?: {
  legalCategories?: string[];
  detectedLaws?: string[];
  keywords?: string[];
  temporalEmphasis?: boolean;
}): ProcessedContext {
  if (!userContext) return { enhancedQuery: '', contextInfo: '' };

  let enhancedQuery = '';
  let contextInfo = '';

  if (userContext.keywords && userContext.keywords.length > 0) {
    enhancedQuery += ` ${userContext.keywords.join(' ')}`;
  }
  if (userContext.detectedLaws && userContext.detectedLaws.length > 0) {
    enhancedQuery += ` ${userContext.detectedLaws.join(' ')}`;
    contextInfo += `\nΣχετικοί νόμοι: ${userContext.detectedLaws.join(', ')}`;
  }
  if (userContext.temporalEmphasis) {
    contextInfo += '\nΈμφαση σε πρόσφατες εξελίξεις: ΝΑΙ';
  }
  if (userContext.legalCategories && userContext.legalCategories.length > 0) {
    contextInfo += `\nΝομικές κατηγορίες: ${userContext.legalCategories.join(', ')}`;
  }

  return {
    enhancedQuery: enhancedQuery.trim(),
    contextInfo: contextInfo
  };
}

// === API CALL LOGIC ===
async function performUnifiedSearch(
  query: string,
  context: ProcessedContext,
  requestId: string
): Promise<any[]> {
  const startTime = Date.now();
  let lastError: any = null;
  
  // OPTIMIZED System Prompt - keeps essential details but more focused
  const systemPrompt = `Είσαι νομικός εξειδικευμένος βοηθός. Απάντησε με ροή λόγου και ακρίβεια.

Κύρια στοιχεία απάντησης:
1. Νόμοι (με αριθμούς και άρθρα) με URLs
2. Δικαστικές αποφάσεις (με αριθμούς) με URLs
3. Πρόσφατες εξελίξεις με URLs
4. URLs πηγών${context?.contextInfo || ''}`;

  const userPrompt = `"${query}" - Απάντησε σε 300 λέξεις με νόμους, αποφάσεις και URLs.`;

  for (let attempt = 0; attempt <= DEEPSEEK_CONFIG.MAX_RETRIES; attempt++) {
    try {
      await deepSeekRateLimiter.waitIfNeeded();

      const request: DeepSeekRequest = {
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: DEEPSEEK_CONFIG.TEMPERATURE,
        max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS,
        stream: false, // Changed to false for better compatibility
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_CONFIG.TIMEOUT);

      const response = await fetch(DEEPSEEK_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data: DeepSeekResponse = await response.json();
      const content = data.choices[0]?.message?.content || '';

      if (!content) {
        throw new Error('Empty response from DeepSeek');
      }

      const parsedResults = parseUnifiedResponse(content, query);
      const enhancedResults = enhanceDeepSeekResults(parsedResults);

      deepSeekRateLimiter.recordSuccess();
      console.log(`DeepSeek unified search completed in ${Date.now() - startTime}ms`);

      return enhancedResults;

    } catch (error: any) {
      lastError = error;
      console.error(`DeepSeek attempt ${attempt + 1} failed:`, error.message);

      if (attempt === DEEPSEEK_CONFIG.MAX_RETRIES) {
        deepSeekRateLimiter.recordError();
        break;
      }

      const delay = DEEPSEEK_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`All DeepSeek attempts failed: ${lastError?.message}`);
}
// === MAIN EXPORT FUNCTION ===
export async function searchDeepSeekForLegal(
  query: string,
  userContext?: {
    legalCategories?: string[];
    detectedLaws?: string[];
    keywords?: string[];
    temporalEmphasis?: boolean;
  }
): Promise<StructuredPerplexityResults> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  try {
    const sanitizedQuery = validateAndSanitizeQuery(query);
    
    // Handle case where no context is provided (default now)
    let context: ProcessedContext;
    let fullQuery = sanitizedQuery;
    
    if (userContext) {
      console.log('🧠 Using enhanced context for DeepSeek');
      context = processEnhancedContext(userContext);
      fullQuery = `${sanitizedQuery}${context.enhancedQuery ? ' ' + context.enhancedQuery : ''}`;
    } else {
      console.log('✨ Using raw query for DeepSeek without enhancement');
      // Create a minimal ProcessedContext with correct types
      context = {
        enhancedQuery: '',
        contextInfo: ''  // Now it's a string as required
      };
    }
    
    // Rest of your function remains the same...
    // Check cache first
    const cacheKey = `${fullQuery}-${JSON.stringify(userContext || {})}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for query: "${fullQuery.substring(0, 50)}..."`);
      return cached;
    }
    
    console.log(`Starting DeepSeek search for: "${fullQuery.substring(0, 50)}..."`);
    
    const results = await performUnifiedSearch(fullQuery, context, requestId);
    const formattedResults = transformToPerplexityFormat(results);
    
    // ... rest of your function unchanged
    
    // Add metadata
    formattedResults.metadata.searchQuery = sanitizedQuery;
    formattedResults.metadata.timestamp = new Date().toISOString();
    
    // ADD VALIDATION HERE
    const validation = validateResponseRelevance(formattedResults, query, userContext);
    
    if (!validation.isRelevant) {
      console.warn(`⚠️ DeepSeek response appears irrelevant (score: ${validation.score}%)`);
      console.warn(`Query: "${query.substring(0, 50)}..."`);
      
      // Return fallback results
      return {
        legislation: Array(4).fill(null).map((_, i) => 
          createPlaceholderResult('legislation', i + 1)
        ),
        jurisprudence: Array(3).fill(null).map((_, i) => 
          createPlaceholderResult('jurisprudence', i + 1)
        ),
        developments: Array(3).fill(null).map((_, i) => 
          createPlaceholderResult('development', i + 1)
        ),
        metadata: {
          totalResults: 0,
          searchQuery: query,
          timestamp: new Date().toISOString()
        },
        success: false
      };
    }
    
    if (validation.score < 60) {
      console.log(`⚡ DeepSeek response borderline relevant (score: ${validation.score}%) - keeping for Claude to filter`);
    } else {
      console.log(`✅ DeepSeek response is relevant (score: ${validation.score}%)`);
    }

    // Cache the results
    responseCache.set(cacheKey, formattedResults);

    console.log(`DeepSeek search completed in ${Date.now() - startTime}ms`);
    return formattedResults;

  } catch (error: any) {
    console.error('DeepSeek search failed:', error.message);
    
    // Return fallback results
    return {
      legislation: Array(4).fill(null).map((_, i) => 
        createPlaceholderResult('legislation', i + 1)
      ),
      jurisprudence: Array(3).fill(null).map((_, i) => 
        createPlaceholderResult('jurisprudence', i + 1)
      ),
      developments: Array(3).fill(null).map((_, i) => 
        createPlaceholderResult('development', i + 1)
      ),
      metadata: {
        totalResults: 0,
        searchQuery: query,
        timestamp: new Date().toISOString()
      },
      success: false
    };
  }
}

// === UTILITY EXPORTS ===
export function clearDeepSeekCache(): void {
  // This would clear the internal cache if implemented
  console.log('Cache clearing functionality would be implemented here');
}

export function getDeepSeekStatus(): {
  configured: boolean;
  rateLimit: number;
  cacheEnabled: boolean;
} {
  return {
    configured: !!DEEPSEEK_CONFIG.API_KEY,
    rateLimit: DEEPSEEK_CONFIG.RATE_LIMIT_PER_MINUTE,
    cacheEnabled: DEEPSEEK_CONFIG.CACHE_ENABLED
  };
}

// Export configuration
export const DEEPSEEK_CONFIG_EXPORT = DEEPSEEK_CONFIG;

// Keep the original default export for backward compatibility
export default {
  searchDeepSeekForLegal,
  clearDeepSeekCache,
  getDeepSeekStatus,
  DEEPSEEK_CONFIG
};
