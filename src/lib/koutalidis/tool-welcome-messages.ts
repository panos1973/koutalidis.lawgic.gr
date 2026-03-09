/**
 * Welcome messages shown when a user first opens a tool.
 * These guide the user on exactly what to upload/provide.
 *
 * Each tool has an English and Greek version.
 */

interface WelcomeMessage {
  title: string
  titleEl: string
  description: string
  descriptionEl: string
  steps: string[]
  stepsEl: string[]
}

export const TOOL_WELCOME_MESSAGES: Record<string, WelcomeMessage> = {
  'cp-checklist': {
    title: 'CP Checklist Generator',
    titleEl: 'Δημιουργία CP Checklist',
    description:
      'Upload your Bond Subscription Agreement and I will extract all Conditions Precedent into a structured checklist.',
    descriptionEl:
      'Ανεβάστε τη Σύμβαση Κάλυψης Ομολογιακού Δανείου και θα εξάγω όλους τους Όρους Προηγούμενους σε δομημένο checklist.',
    steps: [
      'Upload the Bond Subscription Agreement (or the relevant CP schedule)',
      'Optionally upload a precedent CP checklist from a similar transaction',
      'Tell me if this is for a first drawdown or a subsequent drawdown',
    ],
    stepsEl: [
      'Ανεβάστε τη Σύμβαση Κάλυψης Ομολογιακού Δανείου (ή το σχετικό παράρτημα CP)',
      'Προαιρετικά ανεβάστε ένα προηγούμενο CP checklist από παρόμοια συναλλαγή',
      'Πείτε μου αν αφορά πρώτη εκταμίευση ή μεταγενέστερη',
    ],
  },

  'security-perfection': {
    title: 'Security Perfection Steps Plan',
    titleEl: 'Σχέδιο Βημάτων Τελειοποίησης Εξασφαλίσεων',
    description:
      'Upload your security documents and I will extract all perfection steps into a sequenced action plan.',
    descriptionEl:
      'Ανεβάστε τα έγγραφα εξασφαλίσεων και θα εξάγω όλα τα βήματα τελειοποίησης σε χρονολογικό σχέδιο δράσης.',
    steps: [
      'Upload all security documents (pledges, mortgages, assignments, guarantees, etc.)',
      'Optionally upload a precedent steps plan from a similar transaction',
      'Specify the governing law if not Greek law',
    ],
    stepsEl: [
      'Ανεβάστε όλα τα έγγραφα εξασφαλίσεων (ενέχυρα, υποθήκες, εκχωρήσεις, εγγυήσεις κλπ.)',
      'Προαιρετικά ανεβάστε ένα προηγούμενο σχέδιο βημάτων από παρόμοια συναλλαγή',
      'Προσδιορίστε το εφαρμοστέο δίκαιο αν δεν είναι το ελληνικό',
    ],
  },

  'signing-agenda': {
    title: 'Signing Agenda',
    titleEl: 'Agenda Υπογραφής',
    description:
      'Upload a precedent signing agenda or a Bond Subscription Agreement and I will prepare a complete signing agenda for your transaction.',
    descriptionEl:
      'Ανεβάστε μια προηγούμενη agenda υπογραφής ή τη Σύμβαση Κάλυψης και θα ετοιμάσω πλήρη agenda υπογραφής για τη συναλλαγή σας.',
    steps: [
      'Upload a precedent signing agenda from a similar transaction',
      'Or upload the Bond Subscription Agreement / term sheet',
      'Provide party names, signing date, and any special requirements (notarization, apostille, etc.)',
    ],
    stepsEl: [
      'Ανεβάστε μια προηγούμενη agenda υπογραφής από παρόμοια συναλλαγή',
      'Ή ανεβάστε τη Σύμβαση Κάλυψης / term sheet',
      'Δώστε ονόματα μερών, ημερομηνία υπογραφής και τυχόν ειδικές απαιτήσεις (συμβολαιογραφική πράξη, apostille κλπ.)',
    ],
  },

  'bond-certificates': {
    title: 'Bond Certificate Drafting',
    titleEl: 'Σύνταξη Ομολογιακών Τίτλων',
    description:
      "Upload the bond certificate template and the Agent's table of details, and I will generate completed certificates for each bond.",
    descriptionEl:
      'Ανεβάστε το υπόδειγμα ομολογιακού τίτλου και τον πίνακα στοιχείων του Agent, και θα δημιουργήσω συμπληρωμένους τίτλους για κάθε ομολογία.',
    steps: [
      'Upload the template bond certificate (from the programme schedule)',
      "Upload the Agent's table with bond details (amounts, dates, rates, holders)",
      'Optionally upload the bond loan programme for cross-referencing',
    ],
    stepsEl: [
      'Ανεβάστε το υπόδειγμα ομολογιακού τίτλου (από το παράρτημα του προγράμματος)',
      'Ανεβάστε τον πίνακα του Agent με τα στοιχεία ομολογιών (ποσά, ημερομηνίες, επιτόκια, ομολογιούχοι)',
      'Προαιρετικά ανεβάστε το πρόγραμμα ομολογιακού δανείου για διασταύρωση',
    ],
  },

  'bond-programme': {
    title: 'Bond Loan Programme Drafting',
    titleEl: 'Σύνταξη Προγράμματος Ομολογιακού Δανείου',
    description:
      'Upload a precedent programme and the agreed term sheet, and I will prepare a first draft incorporating all commercial terms.',
    descriptionEl:
      'Ανεβάστε ένα προηγούμενο πρόγραμμα και το συμφωνημένο term sheet, και θα ετοιμάσω πρώτο σχέδιο ενσωματώνοντας όλους τους εμπορικούς όρους.',
    steps: [
      'Upload a precedent bond loan programme from a similar transaction',
      'Upload the agreed term sheet',
      'Provide any additional client information (party details, corporate structure, special conditions)',
    ],
    stepsEl: [
      'Ανεβάστε ένα προηγούμενο πρόγραμμα ομολογιακού δανείου από παρόμοια συναλλαγή',
      'Ανεβάστε το συμφωνημένο term sheet',
      'Δώστε τυχόν πρόσθετες πληροφορίες πελάτη (στοιχεία μερών, εταιρική δομή, ειδικοί όροι)',
    ],
  },

  'engagement-letter': {
    title: 'Engagement Letter',
    titleEl: 'Επιστολή Ανάθεσης',
    description:
      'Upload the KLF standard engagement letter template and the fee proposal, and I will prepare a first draft.',
    descriptionEl:
      'Ανεβάστε το τυποποιημένο υπόδειγμα επιστολής ανάθεσης KLF και την πρόταση αμοιβής, και θα ετοιμάσω πρώτο σχέδιο.',
    steps: [
      'Upload the KLF standard engagement letter template',
      'Upload the fee proposal for this engagement',
      'Provide client name, matter description, and responsible partner',
    ],
    stepsEl: [
      'Ανεβάστε το τυποποιημένο υπόδειγμα επιστολής ανάθεσης KLF',
      'Ανεβάστε την πρόταση αμοιβής για αυτή την ανάθεση',
      'Δώστε όνομα πελάτη, περιγραφή υπόθεσης και υπεύθυνο εταίρο',
    ],
  },

  'court-orders': {
    title: 'Court Orders, Bond Requests & Notices',
    titleEl: 'Δικαστικές Αποφάσεις, Αιτήσεις Ομολογιών & Ειδοποιήσεις',
    description:
      'Upload your templates and source documents, and I will generate completed documents with all transaction-specific information.',
    descriptionEl:
      'Ανεβάστε τα υποδείγματά σας και τα πηγαία έγγραφα, και θα δημιουργήσω συμπληρωμένα έγγραφα με όλες τις πληροφορίες της συναλλαγής.',
    steps: [
      'Upload the template(s) for the documents you need (bond request, notice, court order, etc.)',
      'Upload the source documents (BSA, finance documents, or precedent documentation)',
      "Provide any specific instructions from the Agent or Company",
    ],
    stepsEl: [
      'Ανεβάστε τα υποδείγματα για τα έγγραφα που χρειάζεστε (αίτηση ομολογίας, ειδοποίηση, δικαστική απόφαση κλπ.)',
      'Ανεβάστε τα πηγαία έγγραφα (BSA, χρηματοδοτικά έγγραφα ή προηγούμενα)',
      'Δώστε τυχόν συγκεκριμένες οδηγίες από τον Agent ή την Εταιρεία',
    ],
  },

  'programme-review': {
    title: 'Programme Review',
    titleEl: 'Αξιολόγηση Προγράμματος',
    description:
      "Upload the counterparty's draft programme along with your internal template and term sheet, and I will identify deviations and suggest alternative wording.",
    descriptionEl:
      'Ανεβάστε το σχέδιο προγράμματος του αντισυμβαλλομένου μαζί με το εσωτερικό σας υπόδειγμα και το term sheet, και θα εντοπίσω αποκλίσεις και θα προτείνω εναλλακτική διατύπωση.',
    steps: [
      "Upload the draft bond loan programme from the counterparty",
      "Upload the firm's internal bank template",
      'Upload the term sheet for the transaction',
      'Optionally upload relevant precedent programmes for comparison',
    ],
    stepsEl: [
      'Ανεβάστε το σχέδιο προγράμματος ομολογιακού δανείου από τον αντισυμβαλλόμενο',
      'Ανεβάστε το εσωτερικό υπόδειγμα τράπεζας του γραφείου',
      'Ανεβάστε το term sheet της συναλλαγής',
      'Προαιρετικά ανεβάστε σχετικά προηγούμενα προγράμματα για σύγκριση',
    ],
  },

  'query-review': {
    title: 'Query-Specific Review',
    titleEl: 'Ανασκόπηση Συγκεκριμένου Ερωτήματος',
    description:
      "Upload an executed bond loan programme and describe the client's query, and I will identify all relevant provisions and prepare a draft response.",
    descriptionEl:
      'Ανεβάστε ένα υπογεγραμμένο πρόγραμμα ομολογιακού δανείου και περιγράψτε το ερώτημα του πελάτη, και θα εντοπίσω όλες τις σχετικές διατάξεις και θα ετοιμάσω σχέδιο απάντησης.',
    steps: [
      'Upload the executed bond loan programme',
      "Describe the client's specific query (e.g., 'What are the conditions for mandatory prepayment?')",
    ],
    stepsEl: [
      'Ανεβάστε το υπογεγραμμένο πρόγραμμα ομολογιακού δανείου',
      "Περιγράψτε το συγκεκριμένο ερώτημα του πελάτη (π.χ., 'Ποιες είναι οι προϋποθέσεις υποχρεωτικής πρόωρης αποπληρωμής;')",
    ],
  },

  'dd-review': {
    title: 'Finance Due Diligence Review',
    titleEl: 'Νομικός Έλεγχος Χρηματοδοτικών Εγγράφων',
    description:
      'Upload executed finance documents and specify the transaction context, and I will identify risk provisions and prepare DD findings.',
    descriptionEl:
      'Ανεβάστε υπογεγραμμένα χρηματοδοτικά έγγραφα και προσδιορίστε το πλαίσιο της συναλλαγής, και θα εντοπίσω διατάξεις κινδύνου και θα ετοιμάσω ευρήματα νομικού ελέγχου.',
    steps: [
      'Upload the executed finance documents (loan agreements, security documents, intercreditor agreements, etc.)',
      'Specify the transaction context: acquisition, refinancing, or other purpose',
      'Indicate any specific areas of focus (change of control, mandatory prepayment, consent requirements, etc.)',
    ],
    stepsEl: [
      'Ανεβάστε τα υπογεγραμμένα χρηματοδοτικά έγγραφα (δανειακές συμβάσεις, έγγραφα εξασφαλίσεων, συμφωνίες μεταξύ πιστωτών κλπ.)',
      'Προσδιορίστε το πλαίσιο: εξαγορά, αναχρηματοδότηση ή άλλο σκοπό',
      'Υποδείξτε τυχόν συγκεκριμένους τομείς εστίασης (αλλαγή ελέγχου, υποχρεωτική πρόωρη αποπληρωμή, απαιτήσεις συναίνεσης κλπ.)',
    ],
  },

  'en-gr-translation': {
    title: 'Legal Translation EN↔GR',
    titleEl: 'Νομική Μετάφραση EN↔GR',
    description:
      'Upload English security documents along with any precedent Greek translations, and I will produce a legally accurate Greek translation using established terminology.',
    descriptionEl:
      'Ανεβάστε αγγλικά έγγραφα εξασφαλίσεων μαζί με τυχόν προηγούμενες ελληνικές μεταφράσεις, και θα δημιουργήσω νομικά ακριβή ελληνική μετάφραση με καθιερωμένη ορολογία.',
    steps: [
      'Upload the English security document(s) to be translated',
      'Upload any precedent Greek translations of similar documents (to ensure terminology consistency)',
      'Specify if there are any firm-specific terminology preferences',
    ],
    stepsEl: [
      'Ανεβάστε τα αγγλικά έγγραφα εξασφαλίσεων προς μετάφραση',
      'Ανεβάστε τυχόν προηγούμενες ελληνικές μεταφράσεις παρόμοιων εγγράφων (για συνέπεια ορολογίας)',
      'Προσδιορίστε τυχόν προτιμήσεις ορολογίας του γραφείου',
    ],
  },
}

  // --- M&A Tools ---

  'dd-report': {
    title: 'Due Diligence Report',
    titleEl: 'Έκθεση Νομικού Ελέγχου',
    description:
      'Upload data room documents and transaction details, and I will generate a structured legal DD report with findings categorized by risk level.',
    descriptionEl:
      'Ανεβάστε έγγραφα από το data room και στοιχεία της συναλλαγής, και θα δημιουργήσω δομημένη έκθεση νομικού ελέγχου με ευρήματα κατηγοριοποιημένα κατά επίπεδο κινδύνου.',
    steps: [
      'Upload key data room documents (corporate, contracts, litigation, employment, regulatory, etc.)',
      'Provide transaction context: share deal or asset deal, buyer or seller side, jurisdiction',
      'Optionally upload a DD scope/checklist or precedent DD report for structure guidance',
    ],
    stepsEl: [
      'Ανεβάστε βασικά έγγραφα από το data room (εταιρικά, συμβάσεις, δικαστικά, εργασιακά, κανονιστικά κλπ.)',
      'Δώστε πλαίσιο συναλλαγής: share deal ή asset deal, πλευρά αγοραστή ή πωλητή, δικαιοδοσία',
      'Προαιρετικά ανεβάστε DD checklist ή προηγούμενη έκθεση DD για καθοδήγηση δομής',
    ],
  },

  'red-flag-analysis': {
    title: 'Red Flag Analysis',
    titleEl: 'Ανάλυση Red Flag',
    description:
      'Upload key transaction documents and I will perform a rapid red flag review, identifying critical issues and potential deal-breakers.',
    descriptionEl:
      'Ανεβάστε βασικά έγγραφα συναλλαγής και θα εκτελέσω ταχεία ανάλυση red flag, εντοπίζοντας κρίσιμα ζητήματα και πιθανά εμπόδια στη συναλλαγή.',
    steps: [
      'Upload key transaction documents (SPA, shareholders agreement, material contracts, financial statements, litigation files)',
      'Describe the transaction context and any specific areas of concern',
      'Indicate whether acting for buyer or seller',
    ],
    stepsEl: [
      'Ανεβάστε βασικά έγγραφα συναλλαγής (SPA, συμφωνία μετόχων, ουσιώδεις συμβάσεις, οικονομικές καταστάσεις, δικαστικά)',
      'Περιγράψτε το πλαίσιο συναλλαγής και τυχόν συγκεκριμένους τομείς ανησυχίας',
      'Υποδείξτε αν ενεργείτε για αγοραστή ή πωλητή',
    ],
  },

  'spa-review': {
    title: 'SPA Review',
    titleEl: 'Αξιολόγηση SPA',
    description:
      "Upload a draft SPA along with your internal template or term sheet, and I will identify deviations from market standard, flag negotiation points, and suggest alternative wording.",
    descriptionEl:
      'Ανεβάστε σχέδιο SPA μαζί με το εσωτερικό σας υπόδειγμα ή term sheet, και θα εντοπίσω αποκλίσεις από τα αγοραία πρότυπα, θα σημειώσω σημεία διαπραγμάτευσης και θα προτείνω εναλλακτική διατύπωση.',
    steps: [
      'Upload the draft SPA to be reviewed',
      "Upload the firm's internal SPA template or a precedent SPA from a similar transaction",
      'Upload the term sheet / heads of terms (to verify commercial terms)',
      'Indicate whether acting for buyer or seller',
    ],
    stepsEl: [
      'Ανεβάστε το σχέδιο SPA προς αξιολόγηση',
      'Ανεβάστε το εσωτερικό υπόδειγμα SPA ή ένα SPA από παρόμοια συναλλαγή',
      'Ανεβάστε το term sheet / heads of terms (για επαλήθευση εμπορικών όρων)',
      'Υποδείξτε αν ενεργείτε για αγοραστή ή πωλητή',
    ],
  },

  'disclosure-letter': {
    title: 'Disclosure Letter',
    titleEl: 'Επιστολή Γνωστοποιήσεων',
    description:
      'Upload the SPA warranty schedule and supporting data room documents, and I will draft a structured disclosure letter with specific disclosures mapped to each warranty.',
    descriptionEl:
      'Ανεβάστε το παράρτημα εγγυήσεων του SPA και τα σχετικά έγγραφα data room, και θα συντάξω δομημένη επιστολή γνωστοποιήσεων με αντιστοίχιση σε κάθε εγγύηση.',
    steps: [
      'Upload the SPA (or at minimum the warranty schedule)',
      'Upload key data room documents that support disclosures',
      'Provide any specific client instructions on matters to disclose',
      'Optionally upload a precedent disclosure letter for structure guidance',
    ],
    stepsEl: [
      'Ανεβάστε το SPA (ή τουλάχιστον το παράρτημα εγγυήσεων)',
      'Ανεβάστε βασικά έγγραφα data room που υποστηρίζουν τις γνωστοποιήσεις',
      'Δώστε τυχόν συγκεκριμένες οδηγίες πελάτη για θέματα προς γνωστοποίηση',
      'Προαιρετικά ανεβάστε προηγούμενη επιστολή γνωστοποιήσεων για καθοδήγηση δομής',
    ],
  },

  'corporate-minutes': {
    title: 'Corporate Minutes & Resolutions',
    titleEl: 'Εταιρικά Πρακτικά & Αποφάσεις',
    description:
      'Upload the SPA and company details, and I will draft board/shareholder resolutions required for the M&A transaction, compliant with Greek corporate law.',
    descriptionEl:
      'Ανεβάστε το SPA και τα στοιχεία εταιρείας, και θα συντάξω αποφάσεις ΔΣ/ΓΣ για τη συναλλαγή M&A, σύμφωνα με το ελληνικό εταιρικό δίκαιο.',
    steps: [
      'Upload the SPA or transaction documents (to identify required approvals)',
      'Upload the articles of association / bylaws of the relevant company',
      'Provide company details: entity name, registration number, directors, shareholders',
      'Specify which approvals are needed: transaction approval, power of attorney, director changes, etc.',
    ],
    stepsEl: [
      'Ανεβάστε το SPA ή τα έγγραφα συναλλαγής (για εντοπισμό απαιτούμενων εγκρίσεων)',
      'Ανεβάστε το καταστατικό της σχετικής εταιρείας',
      'Δώστε στοιχεία εταιρείας: επωνυμία, ΓΕΜΗ, μέλη ΔΣ, μέτοχοι',
      'Προσδιορίστε ποιες εγκρίσεις χρειάζονται: έγκριση συναλλαγής, πληρεξούσιο, αλλαγές ΔΣ κλπ.',
    ],
  },

export function getWelcomeMessage(
  toolId: string,
  locale: string = 'en'
): WelcomeMessage | null {
  const msg = TOOL_WELCOME_MESSAGES[toolId]
  if (!msg) return null
  return msg
}
