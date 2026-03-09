/**
 * Legal-safe sentence splitting for translation.
 *
 * Handles Greek and English abbreviations, law citations,
 * decimal numbers, and other patterns that contain periods
 * but are NOT sentence boundaries.
 */

// Abbreviations that end with a period but do NOT end a sentence
const NON_TERMINAL_ABBREVS = new Set([
  // Greek legal
  'αρ', 'αρθ', 'αριθ', 'παρ', 'εδ', 'στοιχ', 'περ', 'υπ', 'ν',
  'π.δ', 'κ.λπ', 'κ.ά', 'κ.τ.λ', 'δηλ', 'βλ', 'σελ', 'τ', 'τόμ',
  'αρ.πρωτ', 'φ.ε.κ', 'α.ε', 'ε.π.ε', 'ο.ε', 'ε.ε', 'α.μ',
  // English legal
  'art', 'sec', 'par', 'no', 'nos', 'vol', 'ref', 'inc', 'ltd',
  'corp', 'co', 'etc', 'vs', 'dr', 'mr', 'mrs', 'ms', 'prof',
  'jr', 'sr', 'st', 'dept', 'govt', 'approx', 'e.g', 'i.e', 'cf',
  'ch', 'p', 'pp', 'fig', 'amend',
])

export function splitLegalSentences(text: string): string[] {
  const normalized = text.replace(/[ \t]+/g, ' ').trim()
  if (!normalized) return []

  const sentences: string[] = []
  let current = ''

  const re = /([.!?;·])\s+/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(normalized)) !== null) {
    const punct = match[1]
    const beforePunct = normalized.slice(lastIndex, match.index)
    const chunk = beforePunct + punct

    const afterIdx = match.index + match[0].length
    const charAfter = normalized[afterIdx] ?? ''

    let shouldSplit = true

    if (punct === '.') {
      const wordBefore = chunk.match(/(\S+)\.$/)?.[1]?.toLowerCase() ?? ''

      if (NON_TERMINAL_ABBREVS.has(wordBefore)) {
        shouldSplit = false
      } else if (/\d$/.test(wordBefore) && /^\d/.test(charAfter)) {
        shouldSplit = false
      } else if (/^[a-zα-ωά-ώ]/.test(charAfter)) {
        shouldSplit = false
      } else if (wordBefore.length <= 1 && wordBefore !== '') {
        shouldSplit = false
      }
    }

    if (shouldSplit) {
      current += chunk
      const trimmed = current.trim()
      if (trimmed.length > 0) {
        sentences.push(trimmed)
      }
      current = ''
    } else {
      current += chunk + ' '
    }

    lastIndex = afterIdx
  }

  current += normalized.slice(lastIndex)
  const trimmed = current.trim()
  if (trimmed.length > 0) {
    sentences.push(trimmed)
  }

  return sentences
}
