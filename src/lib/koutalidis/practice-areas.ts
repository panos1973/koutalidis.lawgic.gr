export interface PracticeArea {
  id: string
  name: string
  nameEl: string
  icon: string
  color: string
}

export interface PracticeTool {
  id: string
  practiceAreaId: string
  category: string
  name: string
  nameEl: string
  icon: string
  toolType: 'document-generation' | 'document-review' | 'translation' | 'general'
  apiRoute: string
  systemPromptKey?: string
}

// Maps practice tool IDs to the actual chat API routes
export const TOOL_API_ROUTES: Record<string, string> = {
  // Banking — Document Generation
  'cp-checklist': '/api/banking/document-generation',
  'security-perfection': '/api/banking/document-generation',
  'signing-agenda': '/api/banking/document-generation',
  'bond-certificates': '/api/banking/document-generation',
  'bond-programme': '/api/banking/document-generation',
  'engagement-letter': '/api/banking/document-generation',
  'court-orders': '/api/banking/document-generation',
  // Banking — Document Review
  'programme-review': '/api/banking/document-review',
  'query-review': '/api/banking/document-review',
  'dd-review': '/api/banking/document-review',
  // Banking — Translation
  'en-gr-translation': '/api/banking/translation',
  // M&A
  'dd-report': '/api/ma/document-generation',
  'red-flag-analysis': '/api/ma/document-review',
  'spa-review': '/api/ma/document-review',
  'disclosure-letter': '/api/ma/document-generation',
}

// Maps general tool routes to existing pages
export const GENERAL_TOOL_ROUTES: Record<string, string> = {
  'case-research': '/case-research',
  'document-creation': '/document-creation',
  contract: '/contract',
  'standard-contract': '/standard-contract',
  'compare-contract': '/compare-contract',
  lawbot: '/lawbot',
}

// Static practice areas data for client-side use
export const PRACTICE_AREAS: PracticeArea[] = [
  {
    id: 'banking',
    name: 'Banking & Finance',
    nameEl: 'Τραπεζικό Δίκαιο',
    icon: 'bank',
    color: '#c5032a',
  },
  {
    id: 'ma',
    name: 'M&A',
    nameEl: 'Συγχωνεύσεις & Εξαγορές',
    icon: 'briefcase',
    color: '#7c3aed',
  },
  {
    id: 'energy',
    name: 'Energy',
    nameEl: 'Ενέργεια',
    icon: 'bolt',
    color: '#059669',
  },
  {
    id: 'litigation',
    name: 'Litigation',
    nameEl: 'Δικαστηριακό',
    icon: 'gavel',
    color: '#d97706',
  },
  {
    id: 'digital',
    name: 'Digital / TMT',
    nameEl: 'Ψηφιακό / TMT',
    icon: 'monitor',
    color: '#2563eb',
  },
  {
    id: 'tax',
    name: 'Tax',
    nameEl: 'Φορολογικό',
    icon: 'calculator',
    color: '#dc2626',
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    nameEl: 'Ακίνητα',
    icon: 'building',
    color: '#0891b2',
  },
]

// Static tools organized by practice area and category
export const PRACTICE_TOOLS_BY_AREA: Record<
  string,
  Record<string, PracticeTool[]>
> = {
  banking: {
    'Document Generation': [
      {
        id: 'cp-checklist',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'CP Checklist',
        nameEl: 'CP Checklist',
        icon: 'fileCheck',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
      {
        id: 'security-perfection',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'Security Perfection',
        nameEl: 'Security Perfection Steps',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
      {
        id: 'signing-agenda',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'Signing Agenda',
        nameEl: 'Signing Agenda',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
      {
        id: 'bond-certificates',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'Bond Certificates',
        nameEl: 'Bond Certificates',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
      {
        id: 'bond-programme',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'Bond Programme',
        nameEl: 'Bond Loan Programme',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
      {
        id: 'engagement-letter',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'Engagement Letter',
        nameEl: 'Engagement Letter',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
      {
        id: 'court-orders',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'Court Orders',
        nameEl: 'Court Orders',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
    ],
    'Document Review': [
      {
        id: 'programme-review',
        practiceAreaId: 'banking',
        category: 'Document Review',
        name: 'Programme Review',
        nameEl: 'Programme Review',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/banking/document-review',
      },
      {
        id: 'query-review',
        practiceAreaId: 'banking',
        category: 'Document Review',
        name: 'Query Review',
        nameEl: 'Query Review',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/banking/document-review',
      },
      {
        id: 'dd-review',
        practiceAreaId: 'banking',
        category: 'Document Review',
        name: 'DD Review',
        nameEl: 'Finance DD Review',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/banking/document-review',
      },
    ],
    Translation: [
      {
        id: 'en-gr-translation',
        practiceAreaId: 'banking',
        category: 'Translation',
        name: 'EN↔GR Translation',
        nameEl: 'Μετάφραση EN↔GR',
        icon: 'languages',
        toolType: 'translation',
        apiRoute: '/api/banking/translation',
      },
    ],
  },
  ma: {
    'Due Diligence': [
      {
        id: 'dd-report',
        practiceAreaId: 'ma',
        category: 'Due Diligence',
        name: 'DD Report',
        nameEl: 'Έκθεση Due Diligence',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/ma/document-generation',
      },
      {
        id: 'red-flag-analysis',
        practiceAreaId: 'ma',
        category: 'Due Diligence',
        name: 'Red Flag Analysis',
        nameEl: 'Ανάλυση Red Flag',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/ma/document-review',
      },
    ],
    'Transaction Docs': [
      {
        id: 'spa-review',
        practiceAreaId: 'ma',
        category: 'Transaction Docs',
        name: 'SPA Review',
        nameEl: 'Έλεγχος SPA',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/ma/document-review',
      },
      {
        id: 'disclosure-letter',
        practiceAreaId: 'ma',
        category: 'Transaction Docs',
        name: 'Disclosure Letter',
        nameEl: 'Disclosure Letter',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/ma/document-generation',
      },
    ],
  },
}

// General tools (existing platform tools)
export const GENERAL_TOOLS = [
  {
    id: 'lawbot',
    name: 'Legal Research',
    nameEl: 'Νομική Έρευνα',
    icon: 'messageText',
    route: '/lawbot',
  },
  {
    id: 'case-research',
    name: 'Case Research',
    nameEl: 'Ανάλυση Υπόθεσης',
    icon: 'layer',
    route: '/case-research',
  },
  {
    id: 'document-creation',
    name: 'Document Creation',
    nameEl: 'Δημιουργία Εγγράφου',
    icon: 'documentText',
    route: '/document-creation',
  },
  {
    id: 'contract',
    name: 'Contract (Step by Step)',
    nameEl: 'Σύμβαση Βήμα-Βήμα',
    icon: 'menuBoard',
    route: '/contract',
  },
  {
    id: 'compare-contract',
    name: 'Compare Contracts',
    nameEl: 'Σύγκριση Συμβάσεων',
    icon: 'convertShape',
    route: '/compare-contract',
  },
  {
    id: 'standard-contract',
    name: 'Standard Contracts',
    nameEl: 'Τυποποιημένες Συμβάσεις',
    icon: 'noteAdd',
    route: '/standard-contract',
  },
]
