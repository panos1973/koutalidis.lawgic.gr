import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const units: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 31536000000 },
  { unit: "month", ms: 2628000000 },
  { unit: "day", ms: 86400000 },
  { unit: "hour", ms: 3600000 },
  { unit: "minute", ms: 60000 },
  { unit: "second", ms: 1000 },
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * Get language-sensitive relative time message from Dates.
 * @param relative  - the relative dateTime, generally is in the past or future
 * @param pivot     - the dateTime of reference, generally is the current time
 */
export function relativeTimeFromDates(
  relative: Date | null,
  pivot: Date = new Date()
): string {
  if (!relative) return "";
  const elapsed = relative.getTime() - pivot.getTime();
  return relativeTimeFromElapsed(elapsed);
}

/**
 * Get language-sensitive relative time message from elapsed time.
 * @param elapsed   - the elapsed time in milliseconds
 */
export function relativeTimeFromElapsed(elapsed: number): string {
  for (const { unit, ms } of units) {
    if (Math.abs(elapsed) >= ms || unit === "second") {
      return rtf.format(Math.round(elapsed / ms), unit);
    }
  }
  return "";
}

/**
 * Format a given date to a string in the format DD/MM/YY T:HH:MM.
 * @param date - The date to format. If null, it returns an empty string.
 */
export function formatDateToCustomFormat(date: Date | null): string {
  if (!date) return "";

  const padZero = (num: number) => num.toString().padStart(2, "0");

  const day = padZero(date.getDate());
  const month = padZero(date.getMonth() + 1); // Months are zero-based, so add 1
  const year = date.getFullYear().toString().slice(-2); // Get last two digits
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const getGreekGregoryDate = (date: Date) => {
  return date.toLocaleDateString("el-GR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
    calendar: "gregory", // Explicitly set to the Gregorian calendar
  });
};

/**
 * Get time-based greeting message in English or Greek
 * @param locale - 'en' for English or 'el' for Greek
 * @returns Appropriate greeting based on current time
 */
export function getTimeBasedGreeting(locale: "en" | "el" = "en"): string {
  const currentHour = new Date().getHours();

  const greetings = {
    en: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
      night: "Good night",
    },
    el: {
      morning: "Καλημέρα",
      afternoon: "Καλό απόγευμα",
      evening: "Καλησπέρα",
      night: "Καληνύχτα",
    },
  };

  if (currentHour >= 5 && currentHour < 12) {
    return greetings[locale].morning;
  } else if (currentHour >= 12 && currentHour < 17) {
    return greetings[locale].afternoon;
  } else if (currentHour >= 17 && currentHour < 22) {
    return greetings[locale].evening;
  } else {
    return greetings[locale].night;
  }
}

// ===========================
// URL Processing Functions for Legal Document Links
// ===========================

const DEFAULT_BASE_URL = 'https://corp.lawgic.gr';

/**
 * Selectively processes document URLs based on document type
 * @param content - Content with URLs
 * @param referenceType - Type of reference (e.g., 'law', 'court', 'database_law', 'database_case')
 * @returns Processed content
 */
export function processDocumentUrlsSelectively(content: string, referenceType: string): string {
  if (!content || typeof content !== 'string') {
    return content || '';
  }

  // Only remove URLs for database_law type
  if (referenceType === 'database_law') {
    // Remove markdown links with /api/documents/law/
    return content
      .replace(/\[([^\]]+)\]\(\/api\/documents\/law\/[^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)?corp\.lawgic\.gr[^)]*\/law\/[^)]+\)/g, '$1')
      .replace(/https?:\/\/corp\.lawgic\.gr\/api\/documents\/law\/[^\s\)]+/g, '')
      .replace(/\/api\/documents\/law\/[^\s\)]+/g, '');
  }
  
  // For all other types (including perplexity, deepseek, youcom, court decisions), 
  // return content as-is (no URL processing to avoid circular dependency)
  return content;
}

/**
 * Process combined results with selective URL handling
 * @param results - Array of results
 * @param referenceTypes - Array of reference types corresponding to results
 * @returns Processed results
 */
export function processResultsWithSelectiveUrls(
  results: string[], 
  referenceTypes: string[]
): string[] {
  return results.map((result, index) => {
    const refType = referenceTypes[index] || 'unknown';
    
    // Handle database_law type (existing logic via processDocumentUrlsSelectively)
    if (refType === 'database_law') {
      return processDocumentUrlsSelectively(result, refType);
    }
    
    // NEW: Simple PDF link transformation for external sources
    if (refType.includes('court') || 
        refType.includes('perplexity') || 
        refType.includes('deepseek') || 
        refType.includes('youcom')) {
      return result.replace(
        /\[([^\]]+)\]\((https:\/\/storage\.googleapis\.com\/past_cases[^)]+\.pdf)\)/g, 
        '[$1 - View Document](javascript:window.open("$2", "_blank"))'
      );
    }
    
    // For all other types, return as-is
    return result;
  });
}

/**
 * Legacy processDocumentUrls function - kept for backward compatibility
 * Now calls the selective version with 'unknown' type
 * @param content - Markdown content with potentially relative URLs
 * @param baseUrl - Base URL to prepend to relative URLs
 * @returns Content with processed URLs
 */
export function processDocumentUrls(content: string, baseUrl: string = DEFAULT_BASE_URL): string {
  // For backward compatibility, treat as unknown type (will keep URLs)
  return processDocumentUrlsSelectively(content, 'unknown');
}

/**
 * Extracts document URLs from XML references and converts them to full URLs
 * @param fullReferences - Array of XML reference strings
 * @param baseUrl - Base URL to prepend to relative URLs
 * @returns Array of full URLs
 */
export function extractAndConvertUrls(fullReferences: string[], baseUrl: string = DEFAULT_BASE_URL): string[] {
  if (!Array.isArray(fullReferences)) {
    return [];
  }

  return fullReferences
    .map(ref => {
      if (!ref || typeof ref !== 'string') return '';
      
      // Extract URL from XML document_url tag
      const urlMatch = ref.match(/<document_url>([^<]+)<\/document_url>/);
      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];
        
        // Convert relative URLs to full URLs
        if (url.startsWith('/api/documents/')) {
          return `${baseUrl}${url}`;
        }
        
        // Add protocol to partial URLs
        if (url.includes('corp.lawgic.gr') && !url.startsWith('http')) {
          return url.startsWith('//') ? 
            `https:${url}` : `https://${url}`;
        }
        
        return url;
      }
      return '';
    })
    .filter(url => url.length > 0);
}

/**
 * Validates if a URL is properly formatted
 * @param url - URL to validate
 * @returns true if URL is valid
 */
export function isValidDocumentUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts all URLs from markdown content
 * @param content - Markdown content
 * @returns Array of URLs found in the content
 */
export function extractUrlsFromMarkdown(content: string): string[] {
  if (!content || typeof content !== 'string') return [];
  
  const urlRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const urls: string[] = [];
  let match;
  
  while ((match = urlRegex.exec(content)) !== null) {
    urls.push(match[2]);
  }
  
  return urls;
}

/**
 * Processes URLs in AI-generated responses for consistency
 * @param aiResponse - Response from AI containing potential URLs
 * @param baseUrl - Base URL for relative links
 * @returns Processed response with full URLs
 */
export function processAiResponseUrls(aiResponse: string, baseUrl: string = DEFAULT_BASE_URL): string {
  return processDocumentUrls(aiResponse, baseUrl);
}

/**
 * Debug function to analyze URL processing results
 * @param originalContent - Original content before processing
 * @param processedContent - Content after URL processing
 * @returns Analysis object with statistics
 */
export function analyzeUrlProcessing(originalContent: string, processedContent: string) {
  const originalUrls = extractUrlsFromMarkdown(originalContent);
  const processedUrls = extractUrlsFromMarkdown(processedContent);
  
  const relativeUrls = originalUrls.filter(url => url.startsWith('/'));
  const fullUrls = processedUrls.filter(url => url.startsWith('http'));
  
  return {
    originalUrlCount: originalUrls.length,
    processedUrlCount: processedUrls.length,
    relativeUrlsConverted: relativeUrls.length,
    fullUrlsGenerated: fullUrls.length,
    conversionRate: originalUrls.length > 0 ? (fullUrls.length / originalUrls.length * 100) : 0,
    urls: {
      original: originalUrls,
      processed: processedUrls,
    }
  };
}
