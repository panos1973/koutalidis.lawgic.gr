import dotenv from 'dotenv'
dotenv.config()

/**
 * Interfaces (διατήρηση υπαρχόντων + νέα) 
 */
interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface PerplexityRequest {
  model: string
  messages: PerplexityMessage[]
  search_domain_filter?: string[]
  response_format?: {
    type: 'json_schema'
    json_schema: {
      schema: any
    }
  }
}

interface PerplexityResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
    delta: {
      role: string
      content: string
    }
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface LegalContext {
  topic?: string
  confidence?: number
  keywords?: string[]
  userQuestion?: string
  lawTypes?: string[]
}

interface LegalSearchContext {
  isFollowUp?: boolean
  shouldSearchRecent?: boolean
}

interface AuthorityRanking {
  score: number
  category: 'official' | 'judicial' | 'academic' | 'professional' | 'news'
  lawTypes: string[]
}

interface CategorizedResult {
  title: string
  url: string
  preview_text: string
  source_domain: string
  publication_date?: string
  confidence: 'high' | 'medium' | 'low'
  category: 'legislation' | 'jurisprudence' | 'development'
}

interface StructuredPerplexityResults {
  legislation: CategorizedResult[]
  jurisprudence: CategorizedResult[]
  developments: CategorizedResult[]
  metadata: {
    totalResults: number
    searchQuery: string
    timestamp: string
  }
  success: boolean
}

/**
 * Ιεραρχία τύπων δικαίου
 */
const LAW_TYPE_HIERARCHY = {
  δημόσιο: [
    'συνταγματικό',
    'διοικητικό',
    'ποινικό',
    'δημοσιονομικό',
    'φορολογικό',
    'εκκλησιαστικό',
  ],
  ιδιωτικό: [
    'αστικό',
    'οικογενειακό',
    'κληρονομικό',
    'εμπορικό',
    'εργατικό',
    'πνευματικής_ιδιοκτησίας',
  ],
  ειδικοί_κλάδοι: [
    'ενεργειακό',
    'ψηφιακό',
    'περιβαλλοντικό',
    'καταναλωτή',
    'ναυτικό',
    'ασφαλιστικό',
    'αξιογράφων',
    'πτωχευτικό',
  ],
  διεθνές: ['δημόσιο_διεθνές', 'ιδιωτικό_διεθνές'],
  άλλοι_ειδικοί: [
    'υγείας',
    'εκπαίδευσης',
    'μέσων_ενημέρωσης',
    'αθλητισμού',
    'κτηματολογικό',
    'μετανάστευσης',
    'ανθρωπίνων_δικαιωμάτων',
    'τροφίμων',
    'τεχνητής_νοημοσύνης',
  ],
}

/**
 * Εμπλουτισμένες λέξεις-κλειδιά ανά τύπο δικαίου και κατηγορία
 */
const ENHANCED_LAW_TYPE_KEYWORDS: Record<string, string[]> = {
  // ΔΗΜΟΣΙΟ ΔΙΚΑΙΟ
  συνταγματικό: [
    'σύνταγμα', 'συνταγματικός', 'θεμελιώδη δικαιώματα', 'συνταγματικός έλεγχος', 'πολίτευμα', 'βουλή', 'πρόεδρος δημοκρατίας',
    'κράτος δικαίου', 'διαχωρισμός εξουσιών', 'ατομικά δικαιώματα', 'κοινωνικά δικαιώματα', 'συνταγματική αναθεώρηση',
    'συνταγματικό δικαστήριο', 'συνταγματική διάταξη', 'αναθεώρηση'
  ],
  διοικητικό: [
    'διοικητική πράξη', 'ΣτΕ', 'διοικητικό δικαστήριο', 'άδεια', 'δημόσια διοίκηση', 'διοικητική διαδικασία', 'ακύρωση',
    'αναστολή', 'δημόσιος υπάλληλος', 'διαγωνισμός', 'δημόσια σύμβαση', 'εκτελεστή πράξη', 'διακριτική ευχέρεια',
    'διοικητική εφεση', 'προσωρινή δικαστική προστασία', 'διοικητικές κυρώσεις', 'διοικητικό πρωτοδικείο', 'διοικητικό εφετείο'
  ],
  ποινικό: [
    'ποινή', 'ποινές', 'ποινικό', 'αδίκημα', 'κατηγορία', 'ποινικό δικαστήριο', '4619/2019', 'ποινικός κώδικας', 'έγκλημα',
    'πλημμέλημα', 'κολακεία', 'φυλάκιση', 'χρηματική ποινή', 'αυτόφωρο', 'κατηγορούμενος', 'ανακριτής', 'εισαγγελέας',
    'δικηγόρος παραστάσεως', 'προανάκριση', 'ανάκριση', 'δίκη', 'καταδίκη', 'αθώωση', 'τεκμήριο αθωότητας', 'ποινικό μητρώο'
  ],
  φορολογικό: [
    'φόρος', 'φορολογικό', 'ΦΠΑ', 'ΑΑΔΕ', 'εισόδημα', 'φορολογική δήλωση', 'φορολογική υποχρέωση', 'φοροδιαφυγή',
    'φορολογικός έλεγχος', 'βεβαίωση', 'εκκαθάριση φόρου', 'φορολογική αντιρρησία', 'φορολογική επιδίωξη', 'ENFIA',
    'φόρος εισοδήματος', 'φόρος κληρονομιάς', 'φόρος δωρεάς', 'τέλη κυκλοφορίας'
  ],
  αστικό: [
    'συμβόλαιο', 'αποζημίωση', 'ευθύνη', 'ενοχικό', 'αστικός κώδικας', 'παραβίαση', 'υποχρέωση', 'εκπλήρωση', 'αχρέωση',
    'υπερημερία', 'εμπράγματο δίκαιο', 'κυριότητα', 'κατοχή', 'δουλεία', 'ενέχυρο', 'υποθήκη', 'δικαίωμα επιφανείας',
    'αστική ευθύνη', 'προσωπικότητα', 'αγοραπωλησία', 'μίσθωση', 'δάνειο', 'εντολή', 'παρακαταθήκη'
  ],
  εμπορικό: [
    'εταιρεία', 'ΑΕ', 'ΕΠΕ', '4548/2018', 'εμπορικό', 'εταιρικό', 'μετοχή', 'εταιρικό μερίδιο', 'διοικητικό συμβούλιο',
    'γενική συνέλευση', 'εμπορική επιχείρηση', 'εμπορικός κώδικας', 'εμπορικές συναλλαγές', 'μετασχηματισμός εταιρείας',
    'διάλυση', 'εκκαθάριση', 'ΙΚΕ', 'ΟΕ', 'ΕΕ', 'εμπορικό μητρώο', 'εμπορικό σήμα'
  ],
  εργατικό: [
    'εργαζόμενος', 'απόλυση', 'μισθός', 'άδεια', 'ΟΑΕΔ', 'συλλογική σύμβαση', 'σύμβαση εργασίας', 'εργοδότης',
    'εργασιακά δικαιώματα', 'εργασιακός χρόνος', 'υπερωρίες', 'αναρρωτική άδεια', 'μητρική άδεια', 'αποζημίωση απόλυσης',
    'επίδομα ανεργίας', 'εργασιακό ατύχημα', 'επαγγελματική ασθένεια', 'συνδικαλισμός', 'εργατοδικείο'
  ],
  ψηφιακό: [
    'GDPR', 'προστασία δεδομένων', 'ψηφιακά δικαιώματα', 'ηλεκτρονικό εμπόριο', 'ηλεκτρονικές συναλλαγές', 'ψηφιακή υπογραφή',
    'cybersecurity', 'διαδίκτυο', 'ψηφιακός μετασχηματισμός', 'τεχνητή νοημοσύνη', 'AI Act', 'cookies',
    'ηλεκτρονική ταυτότητα', 'ψηφιακές υπηρεσίες', 'ηλεκτρονική διακυβέρνηση'
  ],
  // Εμπλουτισμός με επιπλέον κατηγορίες/keywords
  δικαστήρια: [
    'ειρηνοδικείο', 'πρωτοδικείο', 'μονομελές', 'πολυμελές', 'δικαστήριο ανηλίκων', 'εργατοδικείο', 'εφετείο', 'άρειος πάγος',
    'συμβούλιο επικρατείας', 'δικαστική απόφαση', 'δικαστική κρίση', 'νομολογία'
  ],
  νομοθεσία: [
    'νόμος', 'διάταγμα', 'τροπολογία', 'ΦΕΚ', 'άρθρο', 'νομοθεσία', 'κανονισμός', 'προεδρικό διάταγμα', 'υπουργική απόφαση',
    'ευρωπαϊκή οδηγία', 'κανονισμός ΕΕ', 'κύρωση σύμβασης', 'συνταγματική διάταξη', 'ειδικός νόμος'
  ],
  άρθρα: [
    'άρθρο γνώμης', 'ερμηνευτικό σχόλιο', 'επιστημονική ανάλυση', 'σχόλιο νομολογίας', 'συγγραφέας', 'καθηγητής',
    'νομικός σύμβουλος', 'επιστημονική δημοσίευση', 'συλλογικό έργο'
  ],
  βιβλία: [
    'απόσπασμα βιβλίου', 'κεφάλαιο βιβλίου', 'μονογραφία', 'συγγραφέας', 'εκδότης', 'βιβλιογραφία', 'νομικό εγχειρίδιο'
  ],
  γνωμοδοτήσεις: [
    'γνωμοδότηση', 'σχόλιο', 'ερμηνεία', 'νομικός σύμβουλος', 'επιστημονική άποψη', 'επιστημονική γνωμοδότηση'
  ],
  νομικά_νέα: [
    'ανακοίνωση', 'δελτίο τύπου', 'σχόλιο ειδήσεων', 'επίκαιρη νομολογία', 'νομοθετική εξέλιξη', 'νομοθετική πρωτοβουλία',
    'πρόσφατη εξέλιξη', 'νομική επικαιρότητα'
  ]
}

/**
 * Εξουσιοδοτημένα domains και ranking
 */
const ENHANCED_AUTHORITY_RANKINGS: Record<string, AuthorityRanking> = {
  'dsa.gr': {
    score: 1.0,
    category: 'official',
    lawTypes: ['αστικό', 'εμπορικό', 'εταιρικό', 'διοικητικό'],
  },
  'hellenicparliament.gr': {
    score: 1.0,
    category: 'official',
    lawTypes: [
      'συνταγματικό',
      'διοικητικό',
      'φορολογικό',
      'εργατικό',
      'αστικό',
      'ποινικό',
    ],
  },
  'aaade.gr': { score: 0.95, category: 'official', lawTypes: ['φορολογικό'] },
  'areiospagos.gr': {
    score: 0.9,
    category: 'judicial',
    lawTypes: ['ποινικό', 'αστικό', 'κληρονομικό', 'οικογενειακό'],
  },
  'ste.gr': {
    score: 0.85,
    category: 'judicial',
    lawTypes: ['διοικητικό', 'συνταγματικό'],
  },
  'lawspot.gr': {
    score: 0.7,
    category: 'news',
    lawTypes: ['φορολογικό', 'εργατικό', 'αστικό', 'εμπορικό', 'ποινικό'],
  },
  'ethemis.gr': {
    score: 0.7,
    category: 'news',
    lawTypes: ['αστικό', 'εμπορικό', 'ποινικό', 'εργατικό'],
  },
  'eur-lex.europa.eu': {
    score: 1.0,
    category: 'official',
    lawTypes: [
      'ευρωπαϊκό',
      'φορολογικό',
      'εργατικό',
      'ανταγωνισμού',
      'προστασία_δεδομένων',
    ],
  },
  'curia.europa.eu': {
    score: 0.95,
    category: 'judicial',
    lawTypes: ['ευρωπαϊκό', 'ανθρώπινα_δικαιώματα', 'ανταγωνισμού'],
  },
}

/**
 * Βοηθητικές συναρτήσεις
 */
function safeParseJSON(content: string): any {
  try {
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.slice(7).trimStart()
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.slice(3).trimStart()
    }
    if (cleanContent.endsWith('```')) {
      cleanContent = cleanContent.slice(0, -3).trimEnd()
    }
    return JSON.parse(cleanContent)
  } catch (error) {
    return {
      summary: 'Response parsing error',
      recent_developments: [],
      additional_sources: [],
      related_news: [],
      additional_insights: [],
    }
  }
}

function detectLawTypes(query: string): string[] {
  const found: Set<string> = new Set()
  const normalizedQuery = query.toLowerCase().trim()

  for (const [lawType, keywords] of Object.entries(
    ENHANCED_LAW_TYPE_KEYWORDS
  )) {
    const matchCount = keywords.filter((keyword) =>
      normalizedQuery.includes(keyword.toLowerCase())
    ).length

    if (matchCount > 0) {
      found.add(lawType)
      if (matchCount >= 2) {
        found.add(lawType)
      }
    }
  }

  if (found.size === 0) {
    return ['γενικό']
  }

  if (found.size > 5) {
    const lawTypeScores: Array<{ lawType: string; score: number }> = []

    for (const lawType of found) {
      const keywords = ENHANCED_LAW_TYPE_KEYWORDS[lawType]
      const matchCount = keywords.filter((keyword) =>
        normalizedQuery.includes(keyword.toLowerCase())
      ).length

      lawTypeScores.push({
        lawType,
        score: matchCount,
      })
    }

    lawTypeScores.sort((a, b) => b.score - a.score)
    return lawTypeScores.slice(0, 5).map((item) => item.lawType)
  }

  return Array.from(found)
}

function selectDomainsByLawTypes(lawTypes: string[]): string[] {
  const domainScores: Record<string, number> = {}

  for (const [domain, info] of Object.entries(ENHANCED_AUTHORITY_RANKINGS)) {
    let score = 0
    score += info.score * 100

    const matchingTypes = info.lawTypes.filter(
      (type) => lawTypes.includes(type) || lawTypes.includes('γενικό')
    )

    score += matchingTypes.length * 20

    if (info.category === 'official') {
      score += 30
    } else if (info.category === 'judicial') {
      score += 25
    }

    if (matchingTypes.length > 0 || lawTypes.includes('γενικό')) {
      domainScores[domain] = score
    }
  }

  const sortedDomains = Object.entries(domainScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain]) => domain)

  return sortedDomains
}

function categorizePerlexityResult(
  result: any,
  lawTypes: string[],
  targetCategory?: string
): CategorizedResult {
  const domain = result.source_domain || ''
  const title = result.title || ''
  const content = result.preview_text || ''

  let confidence: 'high' | 'medium' | 'low' = 'medium'
  const domainInfo = ENHANCED_AUTHORITY_RANKINGS[domain]

  if (domainInfo) {
    if (domainInfo.score >= 0.9) confidence = 'high'
    else if (domainInfo.score >= 0.7) confidence = 'medium'
    else confidence = 'low'
  }

  let category: 'legislation' | 'jurisprudence' | 'development' =
    (targetCategory as any) || 'development'

  if (!targetCategory) {
    const legislationTerms = [
      'νόμος', 'διάταγμα', 'τροπολογία', 'ΦΕΚ', 'άρθρο', 'νομοθεσία', 'κανονισμός',
      'προεδρικό διάταγμα', 'υπουργική απόφαση', 'ευρωπαϊκή οδηγία', 'κανονισμός ΕΕ'
    ]
    const legislationScore = legislationTerms.reduce(
      (score, term) =>
        score +
        (title.toLowerCase().includes(term) ? 2 : 0) +
        (content.toLowerCase().includes(term) ? 1 : 0),
      0
    )

    const jurisprudenceTerms = [
      'απόφαση', 'δικαστήριο', 'ΑΠ', 'ΣτΕ', 'εφετείο', 'νομολογία', 'κρίση',
      'ειρηνοδικείο', 'πρωτοδικείο', 'μονομελές', 'πολυμελές', 'εργατοδικείο'
    ]
    const jurisprudenceScore = jurisprudenceTerms.reduce(
      (score, term) =>
        score +
        (title.toLowerCase().includes(term) ? 2 : 0) +
        (content.toLowerCase().includes(term) ? 1 : 0),
      0
    )

    if (legislationScore > jurisprudenceScore && legislationScore >= 2) {
      category = 'legislation'
    } else if (jurisprudenceScore >= 2) {
      category = 'jurisprudence'
    }
  }
  
  let finalUrl = result.url || '#';
  
  if (!finalUrl || finalUrl === '#' || finalUrl === '') {
    const title = result.title || '';
    if (result.source_domain && result.source_domain !== 'fallback') {
      // Create proper search URLs
      const urlMap: Record<string, string> = {
        'et.gr': `https://www.et.gr/search?q=${encodeURIComponent(title)}`,
        'areiospagos.gr': `https://www.areiospagos.gr/search?q=${encodeURIComponent(title)}`,
        'adjustice.gr': `https://www.adjustice.gr/search?q=${encodeURIComponent(title)}`,
      };
      finalUrl = urlMap[result.source_domain] || `https://${result.source_domain}/search?q=${encodeURIComponent(title)}`;
    } else {
      finalUrl = `https://www.google.com/search?q=${encodeURIComponent(title + ' νομική πηγή')}`;
    }
  }
  
  return {
    title: result.title || 'Untitled',
    url: result.url,
    preview_text:
      result.preview_text || result.description || 'No preview available',
    source_domain: result.source_domain || 'unknown',
    publication_date: result.publication_date,
    confidence,
    category,
  }
}

function processAndCategorizeResults(
  specializedData: any,
  generalData: any,
  lawTypes: string[]
): StructuredPerplexityResults {
  const allResults: CategorizedResult[] = []
  const rawResults: any[] = []

  if (specializedData?.recent_developments) {
    rawResults.push(...specializedData.recent_developments)
  }
  if (generalData?.related_news) {
    rawResults.push(...generalData.related_news)
  }
  if (generalData?.additional_insights) {
    rawResults.push(...generalData.additional_insights)
  }
  if (generalData?.additional_sources) {
    rawResults.push(...generalData.additional_sources)
  }

  while (rawResults.length < 10 && rawResults.length > 0) {
    rawResults.push(...rawResults.slice(0, Math.min(3, rawResults.length)))
  }

  const autoCategorized = rawResults.map((result) =>
    categorizePerlexityResult(result, lawTypes)
  )

  const legislation: CategorizedResult[] = []
  const jurisprudence: CategorizedResult[] = []
  const developments: CategorizedResult[] = []

  autoCategorized.forEach((result) => {
    if (result.category === 'legislation' && legislation.length < 4) {
      legislation.push(result)
    } else if (
      result.category === 'jurisprudence' &&
      jurisprudence.length < 3
    ) {
      jurisprudence.push(result)
    } else if (result.category === 'development' && developments.length < 3) {
      developments.push(result)
    }
  })

  const remaining = autoCategorized.filter(
    (result) =>
      !legislation.includes(result) &&
      !jurisprudence.includes(result) &&
      !developments.includes(result)
  )

  let remainingIndex = 0

  while (legislation.length < 4 && remainingIndex < remaining.length) {
    const forcedResult = { ...remaining[remainingIndex] }
    forcedResult.category = 'legislation'
    legislation.push(forcedResult)
    remainingIndex++
  }
  while (jurisprudence.length < 3 && remainingIndex < remaining.length) {
    const forcedResult = { ...remaining[remainingIndex] }
    forcedResult.category = 'jurisprudence'
    jurisprudence.push(forcedResult)
    remainingIndex++
  }
  while (developments.length < 3 && remainingIndex < remaining.length) {
    const forcedResult = { ...remaining[remainingIndex] }
    forcedResult.category = 'development'
    developments.push(forcedResult)
    remainingIndex++
  }

  while (legislation.length < 4) {
    legislation.push({
      title: `Νομοθετική πηγή ${legislation.length + 1}`,
      url: '#',
      preview_text:
        'Δεν βρέθηκαν επιπλέον νομοθετικές πηγές για το συγκεκριμένο ερώτημα.',
      source_domain: 'placeholder',
      confidence: 'low',
      category: 'legislation',
    })
  }
  while (jurisprudence.length < 3) {
    jurisprudence.push({
      title: `Δικαστική απόφαση ${jurisprudence.length + 1}`,
      url: '#',
      preview_text:
        'Δεν βρέθηκαν επιπλέον δικαστικές αποφάσεις για το συγκεκριμένο ερώτημα.',
      source_domain: 'placeholder',
      confidence: 'low',
      category: 'jurisprudence',
    })
  }
  while (developments.length < 3) {
    developments.push({
      title: `Πρόσφατη εξέλιξη ${developments.length + 1}`,
      url: '#',
      preview_text:
        'Δεν βρέθηκαν επιπλέον πρόσφατες εξελίξεις για το συγκεκριμένο ερώτημα.',
      source_domain: 'placeholder',
      confidence: 'low',
      category: 'development',
    })
  }

  return {
    legislation: legislation.slice(0, 4),
    jurisprudence: jurisprudence.slice(0, 3),
    developments: developments.slice(0, 3),
    metadata: {
      totalResults:
        legislation.length + jurisprudence.length + developments.length,
      searchQuery: '',
      timestamp: new Date().toISOString(),
    },
    success: true,
  }
}

/**
 * Validates if API response is relevant to the query
 * PERMISSIVE: Only filters obvious mistakes, lets Claude do fine-grained filtering
 */
function validateResponseRelevance(
  apiResponse: any,
  userQuery: string,
  queryIntent?: {
    legalCategories?: string[];
    detectedLaws?: string[];
    keywords?: string[];
  }
): { isRelevant: boolean; score: number } {
  
  // Extract meaningful terms from query
  const stopWords = new Set([
    'το', 'τα', 'τη', 'την', 'του', 'των', 'τις', 'τους',
    'και', 'ή', 'με', 'σε', 'για', 'από', 'στο', 'στη',
    'the', 'a', 'an', 'and', 'or', 'with', 'for', 'from',
    'είναι', 'έχει', 'έχω', 'μπορώ', 'θέλω', 'is', 'has', 'can'
  ]);
  
  const words = userQuery.toLowerCase().split(/\s+/);
  const queryTerms: string[] = [];
  
  // Single words and 2-word phrases
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
  
  // Extract response text
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
  
  // Calculate relevance score
  let matchedTerms = 0;
  for (const term of queryTerms.slice(0, 15)) { // Check up to 15 terms
    if (responseText.includes(term)) {
      matchedTerms++;
    }
  }
  
  // Need only 30% of terms to match (permissive)
  const score = queryTerms.length > 0 
    ? Math.min((matchedTerms / Math.max(queryTerms.length * 0.3, 1)) * 100, 100)
    : 50; // No terms to check, give benefit of doubt
    
  return {
    isRelevant: score >= 40, // Only filter if less than 20% relevant
    score: Math.round(score)
  };
}

/**
 * Κύρια συνάρτηση αναζήτησης
 */
export async function searchInternetForLegal(
  query: string,
  userContext?: LegalSearchContext | {
    legalCategories?: string[];
    detectedLaws?: string[];
    keywords?: string[];
    temporalEmphasis?: boolean;
  }
): Promise<StructuredPerplexityResults> {
  if (!query.trim()) throw new Error('Search query cannot be empty')
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
  if (!PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY not found in environment variables')
    throw new Error('Perplexity API key not configured')
  }
  
  // Handle the case where no context is provided (which is now the default)
  let enhancedContext = null;
  if (userContext && 'legalCategories' in userContext) {
    enhancedContext = userContext;
    console.log('🧠 Using enhanced context:', {
      categories: enhancedContext.legalCategories,
      laws: enhancedContext.detectedLaws,
      keywords: enhancedContext.keywords,
      temporal: enhancedContext.temporalEmphasis
    });
  } else {
    console.log('✨ Using raw query without enhancement');
  }

  const lawTypes = enhancedContext?.legalCategories && enhancedContext.legalCategories.length > 0
    ? enhancedContext.legalCategories
    : detectLawTypes(query);
  const selectedDomains = selectDomainsByLawTypes(lawTypes);
  let enhancedQuery = query;
  const contextInfo = enhancedContext ? `
ΕΠΙΠΛΕΟΝ ΠΛΗΡΟΦΟΡΙΕΣ:
- Νομικές κατηγορίες: ${enhancedContext.legalCategories?.join(', ') || 'γενικό'}
- Ανιχνευμένοι νόμοι: ${enhancedContext.detectedLaws?.join(', ') || 'κανένας'}
- Λέξεις-κλειδιά: ${enhancedContext.keywords?.join(', ') || 'κανένα'}
- Έμφαση σε πρόσφατα: ${enhancedContext.temporalEmphasis ? 'ΝΑΙ' : 'ΟΧΙ'}
` : '';

  const specializedSystemPrompt = `Είσαι εξειδικευμένος νομικός βοηθός που αναζητά επίσημες νομοθετικές πηγές.${contextInfo}

Επικεντρώσου σε:
- Νόμους, διατάγματα, τροπολογίες, ΦΕΚ, προεδρικά διατάγματα, υπουργικές αποφάσεις, ευρωπαϊκές οδηγίες, κανονισμούς ΕΕ, κύρωση συμβάσεων
- Επίσημες κυβερνητικές ανακοινώσεις
- Νομοθετικές αλλαγές και νέους νόμους${enhancedContext?.temporalEmphasis ? '\n- ΠΡΟΤΕΡΑΙΟΤΗΤΑ σε πρόσφατες αλλαγές (2024-2025)' : ''}
${enhancedContext?.detectedLaws && enhancedContext.detectedLaws.length > 0 ? `- Ειδική έμφαση στους νόμους: ${enhancedContext.detectedLaws.join(', ')}` : ''}

Πάντα να περιλαμβάνεις το URL της πηγής.`;

  const generalSystemPrompt = `Είσαι νομικός βοηθός που αναζητά δικαστικές αποφάσεις, γνωμοδοτήσεις, άρθρα, αποσπάσματα βιβλίων και πρόσφατες εξελίξεις.${contextInfo}

Επικεντρώσου σε:
- Δικαστικές αποφάσεις (ΑΠ, ΣτΕ, Εφετεία, ειρηνοδικεία, πρωτοδικεία, εργατοδικεία)
- Νομολογιακές εξελίξεις
- Πρακτικές οδηγίες, γνωμοδοτήσεις, επιστημονικά άρθρα, αποσπάσματα βιβλίων
- Πρόσφατα νομικά νέα${enhancedContext?.temporalEmphasis ? '\n- ΠΡΟΤΕΡΑΙΟΤΗΤΑ σε πρόσφατες αποφάσεις (2024-2025)' : ''}
${enhancedContext?.detectedLaws && enhancedContext.detectedLaws.length > 0 ? `- Αποφάσεις σχετικές με: ${enhancedContext.detectedLaws.join(', ')}` : ''}

Πάντα να περιλαμβάνεις το URL της πηγής.`;

  const ENHANCED_LEGISLATION_SCHEMA = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      recent_developments: {
        type: 'array',
        minItems: 4,
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            preview_text: { type: 'string' },
            source_domain: { type: 'string' },
            publication_date: { type: 'string' },
          },
          required: ['title', 'url', 'preview_text', 'source_domain'],
        },
      },
      additional_sources: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['title', 'url'],
        },
      },
    },
    required: ['summary', 'recent_developments'],
    additionalProperties: false,
  }

  const ENHANCED_JURISPRUDENCE_SCHEMA = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      related_news: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            preview_text: { type: 'string' },
            source_domain: { type: 'string' },
            publication_date: { type: 'string' },
          },
          required: ['title', 'url', 'preview_text', 'source_domain'],
        },
      },
      additional_insights: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            description: { type: 'string' },
            source_type: { type: 'string' },
          },
          required: ['title', 'url', 'description', 'source_type'],
        },
      },
      additional_sources: {
        type: 'array',
        maxItems: 2,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['title', 'url'],
        },
      },
    },
    required: ['summary', 'related_news', 'additional_insights'],
    additionalProperties: false,
  }

  const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
  const headers = {
    Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json',
    accept: 'application/json',
  }

  const specializedPayload: PerplexityRequest = {
    model: 'sonar-pro',
    messages: [
      { role: 'system', content: specializedSystemPrompt },
      { role: 'user', content: enhancedQuery },
    ],
    // search_domain_filter: selectedDomains, // Αν θέλεις domain filtering
    response_format: {
      type: 'json_schema',
      json_schema: { schema: ENHANCED_LEGISLATION_SCHEMA },
    },
  }

  const generalPayload: PerplexityRequest = {
    model: 'sonar-pro',
    messages: [
      { role: 'system', content: generalSystemPrompt },
      { role: 'user', content: enhancedQuery },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { schema: ENHANCED_JURISPRUDENCE_SCHEMA },
    },
  }

  try {
    console.log('🔍 Making Perplexity API calls...')
    console.log('Selected domains:', selectedDomains)
    console.log('Law types detected:', lawTypes)
    console.log('⏰ PERPLEXITY START:', new Date().toISOString())
 
if (enhancedContext) {
  console.log('🧠 Claude enhanced context applied:', {
    originalQuery: query,
    enhancedQuery: enhancedQuery,  // This will now be same as originalQuery
    categories: enhancedContext.legalCategories,
    detectedLaws: enhancedContext.detectedLaws,
    keywords: enhancedContext.keywords,
    temporalEmphasis: enhancedContext.temporalEmphasis
  });
  
  // Add this new log to make it clear what's happening
  console.log('✨ Perplexity receives CLEAN query (no additions)');
} else {
  console.log('🔍 Using basic Perplexity search (no Claude context)');
}

    const [specializedResponse, generalResponse] = await Promise.all([
      fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(specializedPayload),
      }),
      fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(generalPayload),
      }),
    ])

    if (!specializedResponse.ok || !generalResponse.ok) {
      throw new Error(
        `Perplexity API error: ${specializedResponse.status} or ${generalResponse.status}`
      )
    }

    let specializedContent: string | undefined = undefined
    let generalContent: string | undefined = undefined

    try {
      const specializedData: PerplexityResponse =
        await specializedResponse.json()
      specializedContent = specializedData?.choices?.[0]?.message?.content
    } catch (error) {
      specializedContent = undefined
    }

    try {
      const generalData: PerplexityResponse = await generalResponse.json()
      generalContent = generalData?.choices?.[0]?.message?.content
    } catch (error) {
      generalContent = undefined
    }
    
    // Enhanced debug logging to see full JSON structure
    console.log('=== RAW PERPLEXITY DEBUG ===')
    if (specializedContent) {
      try {
        const parsedSpecialized = JSON.parse(specializedContent)
        console.log('Specialized Content (parsed):', JSON.stringify(parsedSpecialized, null, 2))
      } catch (e) {
        console.log('Raw Specialized Content (unparseable):', specializedContent.substring(0, 1000) + '...')
      }
    } else {
      console.log('Raw Specialized Content: undefined')
    }
    
    if (generalContent) {
      try {
        const parsedGeneral = JSON.parse(generalContent)
        console.log('General Content (parsed):', JSON.stringify(parsedGeneral, null, 2))
      } catch (e) {
        console.log('Raw General Content (unparseable):', generalContent.substring(0, 1000) + '...')
      }
    } else {
      console.log('Raw General Content: undefined')
    }
    console.log('=== END RAW PERPLEXITY DEBUG ===')
    
    const parsedSpecialized = specializedContent
      ? safeParseJSON(specializedContent)
      : {}
    const parsedGeneral = generalContent ? safeParseJSON(generalContent) : {}

    const structuredResults = processAndCategorizeResults(
      parsedSpecialized,
      parsedGeneral,
      lawTypes
    )
    
    // ADD VALIDATION HERE
    const validation = validateResponseRelevance(
      structuredResults, 
      query, 
      enhancedContext || {}
    );
    
    if (!validation.isRelevant) {
      console.warn(`⚠️ Perplexity response appears irrelevant (score: ${validation.score}%)`);
      console.warn(`Query: "${query.substring(0, 50)}..."`);
      
      // Return the fallback results
      return {
        legislation: Array.from({ length: 4 }, (_, i) => ({
          title: `Νομοθετική πηγή ${i + 1}`,
          url: '#',
          preview_text: 'Δεν βρέθηκαν σχετικά αποτελέσματα για το ερώτημά σας.',
          source_domain: 'fallback',
          confidence: 'low' as const,
          category: 'legislation' as const,
        })),
        jurisprudence: Array.from({ length: 3 }, (_, i) => ({
          title: `Δικαστική απόφαση ${i + 1}`,
          url: '#',
          preview_text: 'Δεν βρέθηκαν σχετικά αποτελέσματα για το ερώτημά σας.',
          source_domain: 'fallback',
          confidence: 'low' as const,
          category: 'jurisprudence' as const,
        })),
        developments: Array.from({ length: 3 }, (_, i) => ({
          title: `Πρόσφατη εξέλιξη ${i + 1}`,
          url: '#',
          preview_text: 'Δεν βρέθηκαν σχετικά αποτελέσματα για το ερώτημά σας.',
          source_domain: 'fallback',
          confidence: 'low' as const,
          category: 'development' as const,
        })),
        metadata: {
          totalResults: 0,
          searchQuery: query,
          timestamp: new Date().toISOString(),
        },
        success: false,
      };
    }
    
    if (validation.score < 60) {
      console.log(`⚡ Perplexity response borderline relevant (score: ${validation.score}%) - keeping for Claude to filter`);
    } else {
      console.log(`✅ Perplexity response is relevant (score: ${validation.score}%)`);
    }

    structuredResults.metadata.searchQuery = query

    return structuredResults
  } catch (error) {
    return {
      legislation: Array.from({ length: 4 }, (_, i) => ({
        title: `Νομοθετική πηγή ${i + 1}`,
        url: '#',
        preview_text: 'Η αναζήτηση δεν ήταν δυνατή. Παρακαλώ δοκιμάστε ξανά.',
        source_domain: 'fallback',
        confidence: 'low' as const,
        category: 'legislation' as const,
      })),
      jurisprudence: Array.from({ length: 3 }, (_, i) => ({
        title: `Δικαστική απόφαση ${i + 1}`,
        url: '#',
        preview_text: 'Η αναζήτηση δεν ήταν δυνατή. Παρακαλώ δοκιμάστε ξανά.',
        source_domain: 'fallback',
        confidence: 'low' as const,
        category: 'jurisprudence' as const,
      })),
      developments: Array.from({ length: 3 }, (_, i) => ({
        title: `Πρόσφατη εξέλιξη ${i + 1}`,
        url: '#',
        preview_text: 'Η αναζήτηση δεν ήταν δυνατή. Παρακαλώ δοκιμάστε ξανά.',
        source_domain: 'fallback',
        confidence: 'low' as const,
        category: 'development' as const,
      })),
      metadata: {
        totalResults: 0,
        searchQuery: query,
        timestamp: new Date().toISOString(),
      },
      success: false,
    }
  }
}

/**
 * Εξαγωγή όλων των συναρτήσεων και σταθερών
 */
export {
  ENHANCED_LAW_TYPE_KEYWORDS,
  ENHANCED_AUTHORITY_RANKINGS,
  LAW_TYPE_HIERARCHY,
  detectLawTypes,
  selectDomainsByLawTypes,
  safeParseJSON,
  type StructuredPerplexityResults,
  type CategorizedResult,
}
