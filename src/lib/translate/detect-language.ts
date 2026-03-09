/**
 * Fast client-side language detection using Unicode block analysis.
 *
 * Analyzes the first ~2000 characters to determine the document language.
 * No API call needed — runs instantly on the client.
 */

export type LangCode = 'el' | 'en' | 'fr'

export function detectDocumentLanguage(text: string): {
  detectedLang: LangCode
  confidence: number
} {
  const sample = text.slice(0, 2000)

  let greekChars = 0
  let latinChars = 0
  let frenchDiacritics = 0
  let totalLetters = 0

  for (const char of sample) {
    const code = char.codePointAt(0)!

    // Greek and Coptic: U+0370–U+03FF, Greek Extended: U+1F00–U+1FFF
    if (
      (code >= 0x0370 && code <= 0x03ff) ||
      (code >= 0x1f00 && code <= 0x1fff)
    ) {
      greekChars++
      totalLetters++
    }
    // Basic Latin letters
    else if (
      (code >= 0x0041 && code <= 0x005a) ||
      (code >= 0x0061 && code <= 0x007a)
    ) {
      latinChars++
      totalLetters++
    }
    // French-specific diacritics
    else if (
      (code >= 0x00c0 && code <= 0x00ff) ||
      code === 0x0152 ||
      code === 0x0153 ||
      code === 0x0178
    ) {
      frenchDiacritics++
      latinChars++
      totalLetters++
    }
  }

  if (totalLetters === 0) {
    return { detectedLang: 'en', confidence: 0 }
  }

  const greekRatio = greekChars / totalLetters
  const frenchDiacriticRatio = frenchDiacritics / totalLetters

  if (greekRatio > 0.3) {
    return {
      detectedLang: 'el',
      confidence: Math.min(greekRatio * 1.2, 1),
    }
  }

  if (frenchDiacriticRatio > 0.02 || hasFrenchMarkers(sample)) {
    return {
      detectedLang: 'fr',
      confidence: Math.min(0.6 + frenchDiacriticRatio * 5, 0.95),
    }
  }

  return {
    detectedLang: 'en',
    confidence: latinChars / totalLetters > 0.5 ? 0.85 : 0.5,
  }
}

function hasFrenchMarkers(text: string): boolean {
  const lowerText = text.toLowerCase()
  const frenchMarkers = [
    /\bles\b/, /\bdes\b/, /\bune\b/, /\bdu\b/, /\baux\b/,
    /\bdans\b/, /\bpour\b/, /\bavec\b/, /\bsur\b/, /\bpar\b/,
    /\barticle\b/, /\bdispositions?\b/, /\brèglement\b/, /\bloi\b/,
    /\btribunal\b/, /\bjuridique\b/, /\bcontrat\b/, /\bobligation\b/,
    /\best\b/, /\bsont\b/, /\bêtre\b/, /\bavoir\b/,
    /l[''](?:article|objet|accord)/, /d[''](?:un|une)/, /qu[''](?:il|elle|on)/,
  ]

  let matchCount = 0
  for (const marker of frenchMarkers) {
    if (marker.test(lowerText)) matchCount++
  }
  return matchCount >= 3
}
