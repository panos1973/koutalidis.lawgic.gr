// src/lib/prompts/legal_summary.ts
import Anthropic from '@anthropic-ai/sdk'
export const LEGAL_SUMMARY_PROMPTS = {
  el: `Είστε ειδικός νομικός βοηθός που εξειδικεύεται στη δημιουργία συνοπτικών περιλήψεων νομικών συζητήσεων για τη διατήρηση συνεχούς πλαισίου σε πολυστροφικές συνομιλίες.

Το έργο σας είναι να μετατρέψετε μία πλήρη ανταλλαγή ερώτησης-απάντησης σε μία ακριβή και συμπυκνωμένη περίληψη που θα διατηρεί όλα τα κρίσιμα νομικά στοιχεία για μελλοντική αναφορά.

Η περίληψή σας πρέπει να είναι ακριβώς έξι έως οκτώ γραμμές, όχι περισσότερες, όχι λιγότερες. Κάθε γραμμή πρέπει να περιέχει συγκεκριμένη και πολύτιμη νομική πληροφορία που θα βοηθήσει τον χρήστη να κατανοήσει το νομικό πλαίσιο όταν επιστρέψει στο θέμα αυτό αργότερα.

Ξεκινήστε την πρώτη γραμμή με τη φράση "Ερώτηση:" και συνοψίστε την κεντρική νομική ερώτηση ή το πρόβλημα που τέθηκε από τον χρήστη. Η περίληψη αυτή πρέπει να είναι συγκεκριμένη και να αντικατοπτρίζει το πραγματικό νομικό ζήτημα.

Στη δεύτερη γραμμή, που θα ξεκινάει με "Νομοθεσία:", αναφέρετε όλους τους συγκεκριμένους νόμους, άρθρα, παραγράφους και κανονισμούς που αναφέρθηκαν στην απάντηση. Χρησιμοποιήστε την ακριβή αρίθμηση όπως εμφανίστηκε στο πρωτότυπο κείμενο, για παράδειγμα "Ν.4830/2021, άρθρο 15, παράγραφος 3" ή "Κώδικας Πολιτικής Δικονομίας, άρθρα 280-285".

Η τρίτη γραμμή θα ξεκινάει με "Απάντηση:" και θα περιέχει το κεντρικό συμπέρασμα ή τη νομική θέση που διατυπώθηκε. Εδώ πρέπει να συμπεριλάβετε την ουσιώδη νομική απάντηση, συμπεριλαμβανομένων τυχόν ποσών, προθεσμιών ή συγκεκριμένων υποχρεώσεων.

Στην τέταρτη γραμμή, με τίτλο "Διαδικασία:", περιγράψτε τα πρακτικά βήματα, τις προθεσμίες, τις απαιτήσεις ή τις διαδικασίες που αναφέρθηκαν. Αν υπάρχουν συγκεκριμένες προϋποθέσεις που πρέπει να πληρωθούν ή έγγραφα που πρέπει να κατατεθούν, συμπεριλάβετέ τα εδώ.

Στην πέμπτη γραμμή, που θα ξεκινάει με "Προϋποθέσεις:" ή "Σημαντικό:", αναφέρετε τυχόν ειδικές προϋποθέσεις, εξαιρέσεις, περιορισμούς ή σημαντικές λεπτομέρειες που επηρεάζουν την εφαρμογή του νόμου στη συγκεκριμένη περίπτωση.

Αν υπάρχουν ανοιχτά ζητήματα, αβεβαιότητες ή σημεία που χρειάζονται περαιτέρω διερεύνηση, κλείστε την περίληψή σας με μία γραμμή που ξεκινάει με "Ανοιχτά:" και αναφέρει αυτά τα θέματα συνοπτικά.

Χρησιμοποιήστε ακριβή ελληνική νομική ορολογία και διατηρήστε επαγγελματικό τόνο σε όλη την περίληψη. Η γλώσσα πρέπει να είναι σαφής και συγκεκριμένη, χωρίς περιττές λέξεις ή γενικόλογες εκφράσεις.

Να θυμάστε ότι αυτή η περίληψη θα χρησιμοποιηθεί ως πλαίσιο για μελλοντικές ερωτήσεις του ίδιου χρήστη, οπότε πρέπει να είναι πλήρης αλλά συνοπτική, ακριβής αλλά κατανοητή.

Τώρα, δημιουργήστε την περίληψη για την παρακάτω νομική ανταλλαγή:`,

  en: `Follow the same structure and approach as the Greek prompt above, adapted for English legal terminology and format.`
}

// Implementation function
async function createLegalSummaryWithHaiku(
  userQuestion: string,
  assistantAnswer: string,
  locale: 'en' | 'el' = 'el'
): Promise<string> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })

    const exchangeText = `**ΕΡΩΤΗΣΗ ΧΡΗΣΤΗ:**
${userQuestion}

**ΑΠΑΝΤΗΣΗ ΣΥΣΤΗΜΑΤΟΣ:**
${assistantAnswer}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600, // Slightly more generous for 6-8 lines in Greek
      temperature: 0.1,
      system: LEGAL_SUMMARY_PROMPTS[locale],
      messages: [
        {
          role: 'user',
          content: exchangeText
        }
      ]
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text : ''
    
    // Validate summary format
    const lines = summary.split('\n').filter(line => line.trim().length > 0)
    
    if (lines.length < 5 || lines.length > 9) {
      console.warn(`⚠️ Summary line count (${lines.length}) outside expected range 6-8`)
    }

    // Check for required structure elements in Greek
    const hasRequiredElements = summary.includes('Ερώτηση:') && 
                               summary.includes('Νομοθεσία:') && 
                               summary.includes('Απάντηση:')

    if (!hasRequiredElements) {
      console.warn('⚠️ Summary missing required structural elements')
    }
    
    console.log(`✅ Legal summary created: ${lines.length} lines, ${summary.length} chars`)
    return summary.trim()

  } catch (error) {
    console.error('❌ Haiku legal summarization failed:', error)
    
    // Enhanced fallback with basic structure
    const fallbackSummary = `Ερώτηση: ${userQuestion.substring(0, 120)}...
Νομοθεσία: Βλ. σχετική απάντηση για νομοθετικές αναφορές.
Απάντηση: ${assistantAnswer.substring(0, 150)}...
Σημείωση: Αυτόματη περίληψη λόγω σφάλματος συστήματος.`
    
    console.log('🔄 Using structured fallback summary')
    return fallbackSummary
  }
}

export { createLegalSummaryWithHaiku }
