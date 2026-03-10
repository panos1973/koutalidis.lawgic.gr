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
  description: string
  descriptionEl: string
  icon: string
  toolType: 'document-generation' | 'document-review' | 'general'
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
  // M&A
  'dd-report': '/api/ma/document-generation',
  'red-flag-analysis': '/api/ma/document-review',
  'spa-review': '/api/ma/document-review',
  'disclosure-letter': '/api/ma/document-generation',
  'corporate-minutes': '/api/ma/document-generation',
}

// Maps general tool routes to existing pages
export const GENERAL_TOOL_ROUTES: Record<string, string> = {
  translate: '/translate',
  'case-research': '/case-research',
  'document-creation': '/document-creation',
  contract: '/contract',
  // 'standard-contract': '/standard-contract', // Hidden for now
  'compare-contract': '/compare-contract',
  lawbot: '/lawbot',
  'tabular-review': '/tabular-review',
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
        description: 'Extract Conditions Precedent from Bond Subscription Agreements into structured checklists',
        descriptionEl: 'Εξαγωγή Όρων Προηγούμενων από Συμβάσεις Κάλυψης σε δομημένα checklists',
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
        description: 'Generate perfection steps plans from security documents',
        descriptionEl: 'Δημιουργία σχεδίων βημάτων τελειοποίησης από έγγραφα εξασφαλίσεων',
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
        description: 'Prepare complete signing agendas listing all documents for execution',
        descriptionEl: 'Ετοιμασία πλήρων agendas υπογραφής με όλα τα έγγραφα προς υπογραφή',
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
        description: "Draft bond certificates from templates using the Agent's details",
        descriptionEl: 'Σύνταξη ομολογιακών τίτλων από υποδείγματα με τα στοιχεία του Agent',
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
        description: 'Draft bond loan programmes from precedents and term sheets',
        descriptionEl: 'Σύνταξη προγραμμάτων ομολογιακών δανείων από προηγούμενα και term sheets',
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
        description: 'Prepare engagement letters from KLF template and fee proposals',
        descriptionEl: 'Ετοιμασία επιστολών ανάθεσης από υπόδειγμα KLF και προτάσεις αμοιβής',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/banking/document-generation',
      },
      {
        id: 'court-orders',
        practiceAreaId: 'banking',
        category: 'Document Generation',
        name: 'Court Orders & Notices',
        nameEl: 'Δικαστικές Αποφάσεις & Ειδοποιήσεις',
        description: 'Generate court orders, bond requests, and notices from templates',
        descriptionEl: 'Δημιουργία δικαστικών αποφάσεων, αιτήσεων ομολογιών και ειδοποιήσεων από υποδείγματα',
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
        description: 'Review counterparty drafts against internal templates, flag deviations, suggest wording',
        descriptionEl: 'Αξιολόγηση σχεδίων αντισυμβαλλομένου έναντι εσωτερικών υποδειγμάτων, εντοπισμός αποκλίσεων',
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
        description: 'Search executed programmes for provisions relevant to specific client queries',
        descriptionEl: 'Αναζήτηση υπογεγραμμένων προγραμμάτων για διατάξεις σχετικές με ερωτήματα πελατών',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/banking/document-review',
      },
      {
        id: 'dd-review',
        practiceAreaId: 'banking',
        category: 'Document Review',
        name: 'Finance DD Review',
        nameEl: 'Finance DD Review',
        description: 'Review finance documents for risks, change of control, mandatory prepayment, consent requirements',
        descriptionEl: 'Αξιολόγηση χρηματοδοτικών εγγράφων για κινδύνους, αλλαγή ελέγχου, υποχρεωτική πρόωρη αποπληρωμή',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/banking/document-review',
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
        description: 'Generate structured DD reports with findings categorized by risk level',
        descriptionEl: 'Δημιουργία δομημένων εκθέσεων DD με ευρήματα κατηγοριοποιημένα κατά επίπεδο κινδύνου',
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
        description: 'Identify and analyze red flags from transaction documents',
        descriptionEl: 'Εντοπισμός και ανάλυση red flags από έγγραφα συναλλαγής',
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
        description: 'Review SPAs for key provisions, negotiation points, and missing terms',
        descriptionEl: 'Αξιολόγηση SPAs για βασικές διατάξεις, σημεία διαπραγμάτευσης και ελλείπουσες ρήτρες',
        icon: 'fileCheck',
        toolType: 'document-review',
        apiRoute: '/api/ma/document-review',
      },
      {
        id: 'disclosure-letter',
        practiceAreaId: 'ma',
        category: 'Transaction Docs',
        name: 'Disclosure Letter',
        nameEl: 'Επιστολή Γνωστοποιήσεων',
        description: 'Draft disclosure letters structured against SPA warranties',
        descriptionEl: 'Σύνταξη επιστολών γνωστοποιήσεων δομημένων έναντι εγγυήσεων SPA',
        icon: 'file',
        toolType: 'document-generation',
        apiRoute: '/api/ma/document-generation',
      },
    ],
    'Document Generation': [
      {
        id: 'corporate-minutes',
        practiceAreaId: 'ma',
        category: 'Document Generation',
        name: 'Corporate Minutes',
        nameEl: 'Εταιρικά Πρακτικά',
        description: 'Draft board and shareholder resolutions for M&A transactions under Greek corporate law',
        descriptionEl: 'Σύνταξη αποφάσεων ΔΣ και ΓΣ για συναλλαγές M&A σύμφωνα με το ελληνικό εταιρικό δίκαιο',
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
    id: 'translate',
    name: 'Legal Translation',
    nameEl: 'Νομική Μετάφραση',
    icon: 'languages',
    route: '/translate',
  },
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
    id: 'tabular-review',
    name: 'Tabular Review',
    nameEl: 'Tabular Review',
    icon: 'table',
    route: '/tabular-review',
  },
  // {
  //   id: 'standard-contract',
  //   name: 'Standard Contracts',
  //   nameEl: 'Τυποποιημένες Συμβάσεις',
  //   icon: 'noteAdd',
  //   route: '/standard-contract',
  // },
]

export const VAULT_TOOL = {
  id: 'vault',
  name: 'Vault',
  nameEl: 'Vault',
  icon: 'archive',
  route: '/vault',
}
