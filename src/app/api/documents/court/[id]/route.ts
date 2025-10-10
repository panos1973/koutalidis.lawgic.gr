import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@elastic/elasticsearch'

// Helper function to clean text content from metadata and headers 
function cleanCourtDecisionText(text: string): string {
  if (!text) return ''

  let cleanedText = text

  // === EXISTING COOKIE PATTERNS ===
  const cookiePatterns = [
    /Ο ιστότοπός μας χρησιμοποιεί cookies[\s\S]*?Ενημερώθηκα/gi,
    /Για περισσότερες πληροφορίες σχετικά με τη χρήση των cookies[\s\S]*?πολιτική απορρήτου/gi,
    /ΠΡΟΣΟΧΗ:[\s\S]*?Αποθήκευση\./gi,
    /Μέγεθος Γραμμάτων[\s\S]*?Εκτύπωση/gi,
  ]
  
  cookiePatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '')
  })

  // === DATABASE ERROR PATTERNS ===
  const databaseErrorPatterns = [
    // OpenText Basis SQL errors with Greek court headers
    /ΜΟΝΟΜΕΛΕΣ\s+ΠΡΩΤΟΔΙΚΕΙΟ[\s\S]*?Error:\s*com\.opentext\.basis\.jdbc\.BasisSQLException[\s\S]*?Unable to save the retrieved set[\s\S]*?The maximum number \(\d+\) of active sets was reached[\s\S]*?(?=Απόφασης:|Δικαστήριο:|Αριθ\.|Τόπος:|Περίληψη)/gi,
    
    // Generic OpenText/Basis database errors
    /Error:\s*com\.opentext\.basis[\s\S]*?BasisSQLException[\s\S]*?(?=Απόφασης:|Δικαστήριο:|Αριθ\.|Τόπος:)/gi,
    
    // Connection pool exhaustion errors
    /The maximum number \(\d+\) of active sets was reached[\s\S]*?(?=Απόφασης:|Δικαστήριο:|Αριθ\.|Τόπος:)/gi,
    
    // ISOKRATIS/NOMOS database errors
    /ΝΟΜΟΣ\s+Error:[\s\S]*?(?=Απόφασης:|Δικαστήριο:|Αριθ\.|Τόπος:)/gi,
    /ΙΣΟΚΡΑΤΗΣ\s+Error:[\s\S]*?(?=Απόφασης:|Δικαστήριο:|Αριθ\.|Τόπος:)/gi,
  ]
  
  databaseErrorPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '')
  })
  
  // === NAVIGATION AND UI ELEMENT PATTERNS ===
  const navigationPatterns = [
    // Remove "Μέγεθος Γραμμάτων" anywhere it appears (with possible text between words)
    /Μέγεθος[\s\S]{0,20}?Γραμμάτων/gi,
    
    // Remove numbered navigation patterns (0. followed by text and numbers)
    /^\s*0\.\s*[^.]+?\d+\/\d+/gm,
    
    // Remove multiple forward slashes (2 or more)
    /\/{2,}/g,
    
    // Remove standalone opening parenthesis
    /\(\s*(?=[^)]*$)/g,
    
    // Remove standalone closing parenthesis
    /(?<![^(]*)\s*\)/g,
    
    // Remove empty parentheses with possible whitespace between
    /\(\s*\)/g,
    
    // Pattern for navigation with court names and case numbers (like shown in yellow)
    /^\s*\d+\.\s*Μέγεθος\s+Γραμμάτων\s+\d+\/\d+/gim,
    /^\s*0\.\s*[Α-Ω\s]+\d+\/\d+\s+[Α-Ω]+/gim,
  ]
  
  navigationPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '')
  })
  
  // === NEW PATTERNS FOR THE YELLOW BOILERPLATE TEXT ===
  // Remove the specific Greek National Law Database boilerplate
  const nationalLawDatabasePatterns = [
    // Main pattern matching the yellow text from your image
    /Εθνική\s+Νομολογία[\s\S]*?Αποτελέσματα\s+αναζήτησης[\s\S]*?Αναλυτική\s+προβολή[\s\S]*?ΕΠΙΣΤΡΟΦΗ[\s\S]*?επιγενόμενη\s+άσκηση\s+του\s+δικαιώματος\s+μπορεί\s+να\s+είναι\s+καταχρηστική\./gi,
    
    // Specific pattern for ΜΟΝΟΜΕΛΕΣ ΠΡΩΤΟΔΙΚΕΙΟ headers with case numbers
    /Εθνική\s+Νομολογία[\s\S]*?ΜΟΝΟΜΕΛΕΣ\s+ΠΡΩΤΟΔΙΚΕΙΟ[\s\S]*?\d+\s*-\s*\d+\s+\d+\s+από\s+\d+[\s\S]*?ΒΙΒΛΙΟΓΡΑΦΙΚΕΣ\s+ΠΑΡΑΠΟΜΠΕΣ[\s\S]*?καταχρηστική\./gi,
    
    // Pattern for the specific case you showed (7441 - 2017)
    /Εθνική\s+Νομολογία[\s\S]*?ΜΟΝΟΜΕΛΕΣ\s+ΠΡΩΤΟΔΙΚΕΙΟ\s+-\s+ΑΘΗΝΑ\s+-\s+7441\s+-\s+2017[\s\S]*?επιγενόμενη\s+άσκηση\s+του\s+δικαιώματος\s+μπορεί\s+να\s+είναι\s+καταχρηστική\./gi,
    
    // Broader pattern to catch variations
    /Εθνική\s+Νομολογία[\s\S]{0,3000}?καταχρηστική\./gi,
    
    // Pattern for just the header portion if the full text isn't matched
    /Εθνική\s+Νομολογία\s*\*?\s*Αποτελέσματα\s+αναζήτησης\s*\*?\s*Αναλυτική\s+προβολή\s+ΕΠΙΣΤΡΟΦΗ/gi,
    
    // Pattern for bibliography references section
    /ΣΧΕΤΙΚΟΙ\s+ΝΟΜΟΙ[\s\S]*?ΒΙΒΛΙΟΓΡΑΦΙΚΕΣ\s+ΠΑΡΑΠΟΜΠΕΣ[\s\S]*?(?=Δικαστήριο:|Αριθ\.|Τόπος:|Περίληψη|Η\s+παραίτηση|Ο\s+μερίδουχος)/gi,
    
    // Pattern for the legal text about property rights
    /Η\s+ακυρότητα\s+της\s+διαθήκης\s+από\s+την\s+παράβαση[\s\S]*?δεν\s+πρόκειται\s+να\s+ασκήσει\s+το\s+δικαίωμά\s+του[\s\S]*?επιγενόμενη\s+άσκηση\s+του\s+δικαιώματος\s+μπορεί\s+να\s+είναι\s+καταχρηστική\./gi,
  ]

  // Apply all the new patterns to remove the boilerplate
  nationalLawDatabasePatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '')
  })

  // Remove file paths
  cleanedText = cleanedText.replace(/[A-Z]:\\[^\\]+(?:\\[^\\]+){2,}/g, '')

  // === EXISTING DATABASE KEYWORDS - ENHANCED ===
  const databaseKeywords = [
    'NOMOS',
    'ΝΟΜΟΣ',
    'Netcompany-Intrasoft',
    'Netcompany Intrasoft',
    'ΤΡΑΠΕΖΑ ΝΟΜΙΚΩΝ ΠΛΗΡΟΦΟΡΙΩΝ',
    'Τράπεζα Νομικών Πληροφοριών',
    'ΙΣΟΚΡΑΤΗΣ',
    'ΔΗΜΟΣΙΕΥΣΕΙΣ',
    'Δημοσίευση :',
    'ΔΣΑ \\d+ από \\d+',
    '\\.html',
    'Εκτύπωση',
    '© \\d{4}',
    // Add these new keywords from the boilerplate
    'Εθνική Νομολογία',
    'Αποτελέσματα αναζήτησης',
    'Αναλυτική προβολή',
    'ΕΠΙΣΤΡΟΦΗ',
    'ΣΧΕΤΙΚΟΙ ΝΟΜΟΙ',
    'ΒΙΒΛΙΟΓΡΑΦΙΚΕΣ ΠΑΡΑΠΟΜΠΕΣ',
  ]

  databaseKeywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi')
    cleanedText = cleanedText.replace(regex, '')
  })

  // === EXISTING END PATTERNS ===
  const endPatterns = [
    /(?:^|\n)\s*(?:Ο|Η)\s+ΔΙΚΑΣΤ(?:ΗΣ|ΕΣ)[\s\S]*/i,
    /(?:^|\n)\s*(?:Ο|Η)\s+ΓΡΑΜΜΑΤΕ(?:ΑΣ|ΥΣ)[\s\S]*/i,
    /(?:^|\n)\s*Πρόεδρος\s*:[\s\S]*/i,
    /(?:^|\n)\s*Εισηγητ(?:ής|ρια)\s*:[\s\S]*/i,
    /(?:^|\n)\s*Δικηγόρο(?:ι|ς)\s*:[\s\S]*/i,
    /(?:^|\n)\s*Λήμματα\s*:[\s\S]*/i,
    /(?:^|\n)\s*ΔΗΜΟΣΙΕΥ(?:ΣΗ|ΣΕΙΣ)[\s\S]*/i,
    /(?:^|\n)\s*(?:ΟΙ\s+)?ΔΙΚΑΣΤ(?:ΕΣ|ΑΙ)[\s\S]*/i,
    /(?:^|\n)\s*(?:Ο|Η)\s+ΠΡΟΕΔΡΟΣ[\s\S]*/i,
    /(?:^|\n)\s*(?:Ο|Η)\s+ΕΙΣΗΓΗΤ(?:ΗΣ|ΡΙΑ)[\s\S]*/i,
    /(?:^|\n)\s*ΤΑ ΜΕΛΗ[\s\S]*/i,
    /(?:^|\n)\s*ΥΠΟΓΡΑΦ(?:Η|ΕΣ)[\s\S]*/i,
    /(?:^|\n)\s*(?:Ακριβές\s+)?(?:Αντίγραφο|ΑΝΤΙΓΡΑΦΟ)[\s\S]*/i,
    /(?:^|\n)\s*Για\s+(?:την\s+)?ακρίβεια[\s\S]*/i,
  ]

  for (const pattern of endPatterns) {
    const match = cleanedText.match(pattern)
    if (match && match.index !== undefined) {
      cleanedText = cleanedText.substring(0, match.index)
      break
    }
  }

  // Clean up the end section
  const endSection = cleanedText.substring(Math.max(0, cleanedText.length - 500))
  let cleanedEnd = endSection
  
  const endCookiePatterns = [
    /Ο ιστότοπός μας χρησιμοποιεί cookies[\s\S]*$/gi,
    /Για περισσότερες πληροφορίες[\s\S]*Ενημερώθηκα[\s\S]*$/gi,
    /ΠΡΟΣΟΧΗ:[\s\S]*Αποθήκευση\.[\s\S]*$/gi,
    /Μέγεθος Γραμμάτων[\s\S]*$/gi,
  ]
  
  endCookiePatterns.forEach(pattern => {
    cleanedEnd = cleanedEnd.replace(pattern, '')
  })
  
  if (cleanedEnd !== endSection) {
    cleanedText = cleanedText.substring(0, cleanedText.length - 500) + cleanedEnd
  }

  // === ADDITIONAL CLEANUP FOR NAVIGATION ARTIFACTS ===
  // Clean up any remaining "Μέγεθος" or "Γραμμάτων" that might be orphaned
  cleanedText = cleanedText
    .replace(/\bΜέγεθος\b(?!\s+\S)/gi, '')
    .replace(/\bΓραμμάτων\b(?!\s+\S)/gi, '')
    // Remove sequences of multiple slashes
    .replace(/\/{2,}/g, ' ')
    // REMOVE BACKSLASHES - especially patterns like \ \ \ at the beginning
    .replace(/\\\s*\\\s*\\/g, '') // Remove patterns of three backslashes with optional spaces
    .replace(/^\s*\\+\s*/g, '') // Remove backslashes at the start of text
    .replace(/\s*\\+\s*$/g, '') // Remove backslashes at the end of text
    .replace(/\s+\\\s+/g, ' ') // Replace backslashes surrounded by spaces with single space
    .replace(/\\{2,}/g, '') // Remove multiple consecutive backslashes
    // Remove unmatched parentheses (more aggressive cleanup)
    .replace(/\([^)]*$/, '') // Opening parenthesis without closing
    .replace(/^[^(]*\)/, '') // Closing parenthesis without opening
    // Final whitespace cleanup
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleanedText
}

// Function to intelligently format the court decision text
function formatCourtDecisionText(text: string): string {
  if (!text) return ''

  console.log('Starting text formatting, original length:', text.length)

  let formattedText = cleanCourtDecisionText(text)

  console.log('After cleaning, text length:', formattedText.length)

  const sectionHeaders = [
    'ΑΠΟΦΑΣΗ',
    'ΣΚΕΠΤΙΚΟ',
    'ΙΣΤΟΡΙΚΟ',
    'ΝΟΜΙΚΟ ΜΕΡΟΣ',
    'ΠΡΑΓΜΑΤΙΚΑ ΠΕΡΙΣΤΑΤΙΚΑ',
    'ΑΙΤΙΟΛΟΓΙΚΟ',
    'ΔΙΑΤΑΞΗ',
    'ΓΙΑ ΤΟΥΣ ΛΟΓΟΥΣ ΑΥΤΟΥΣ',
    'ΑΠΟΦΑΣΙΖΕΙ',
    'ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ',
    'ΣΥΜΠΕΡΑΣΜΑ',
    'ΕΠΙΛΟΓΟΣ',
    'Ι. ΙΣΤΟΡΙΚΟ',
    'ΙΙ. ΝΟΜΙΚΟ ΠΛΑΙΣΙΟ',
    'ΙΙΙ. ΣΚΕΠΤΙΚΟ',
    'IV. ΑΠΟΦΑΣΗ',
    'Α. ΙΣΤΟΡΙΚΟ',
    'Β. ΝΟΜΙΚΟ ΜΕΡΟΣ',
    'Γ. ΚΡΙΣΗ',
    'Δ. ΑΠΟΦΑΣΗ',
  ]

  formattedText = formattedText.replace(/\r\n/g, '\n')
  formattedText = formattedText.replace(/\r/g, '\n')

  const lineBreakCount = (formattedText.match(/\n/g) || []).length
  const textLength = formattedText.length
  const avgCharsPerLine = lineBreakCount > 0 ? textLength / lineBreakCount : textLength

  if (avgCharsPerLine > 500 || lineBreakCount < 5) {
    console.log('Text appears to be continuous, adding line breaks intelligently')

    formattedText = formattedText.replace(/([.!;])\s+([Α-ΩA-Z])/g, '$1\n\n$2')

    sectionHeaders.forEach((header) => {
      const regex = new RegExp(`(\\S)\\s*(${header})(?=\\s|:|$)`, 'g')
      formattedText = formattedText.replace(regex, '$1\n\n$2')
    })

    formattedText = formattedText.replace(/([.;])\s+(\d+\.\s+[Α-Ω])/g, '$1\n\n$2')
    formattedText = formattedText.replace(/([.;])\s+((?:Κατά|Επί|Με|Στ(?:ην?|ο)|Από)\s+)/g, '$1\n\n$2')
  }

  let finalHtml = ''
  const hasStructure = sectionHeaders.some((header) => formattedText.includes(header))

  if (hasStructure) {
    console.log('Text has recognizable structure, applying header formatting')

    const lines = formattedText.split('\n')
    let currentParagraphs: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      let isHeader = false
      for (const header of sectionHeaders) {
        const headerRegex = new RegExp(`^${header}(?:\\s|:|$)`, 'i')
        if (headerRegex.test(line)) {
          if (currentParagraphs.length > 0) {
            finalHtml += '<p>' + currentParagraphs.join(' ') + '</p>\n'
            currentParagraphs = []
          }
          finalHtml += `<h2 class="section-header">${line}</h2>\n`
          isHeader = true
          break
        }
      }

      if (isHeader) continue

      if (/^\d+\.\s+/.test(line)) {
        if (currentParagraphs.length > 0) {
          finalHtml += '<p>' + currentParagraphs.join(' ') + '</p>\n'
          currentParagraphs = []
        }
        finalHtml += `<h3 class="numbered-item">${line}</h3>\n`
      } else if (/^[-•]\s+/.test(line)) {
        if (currentParagraphs.length > 0) {
          finalHtml += '<p>' + currentParagraphs.join(' ') + '</p>\n'
          currentParagraphs = []
        }
        if (!finalHtml.endsWith('</ul>\n')) {
          finalHtml += '<ul class="decision-list">\n'
        }
        finalHtml += `<li class="list-item">${line.replace(/^[-•]\s+/, '')}</li>\n`
        if (i === lines.length - 1 || !/^[-•]\s+/.test(lines[i + 1])) {
          finalHtml += '</ul>\n'
        }
      } else if (line.startsWith('"') || line.startsWith('«')) {
        if (currentParagraphs.length > 0) {
          finalHtml += '<p>' + currentParagraphs.join(' ') + '</p>\n'
          currentParagraphs = []
        }
        finalHtml += `<blockquote class="quoted-text">${line}</blockquote>\n`
      } else {
        currentParagraphs.push(line)
        if (line.endsWith('.') || line.endsWith(';') || line.endsWith('!') || line.endsWith('?')) {
          if (currentParagraphs.length > 3 || currentParagraphs.join(' ').length > 400) {
            finalHtml += '<p>' + currentParagraphs.join(' ') + '</p>\n'
            currentParagraphs = []
          }
        }
      }
    }

    if (currentParagraphs.length > 0) {
      finalHtml += '<p>' + currentParagraphs.join(' ') + '</p>\n'
    }
  } else {
    console.log('No clear structure found, creating basic paragraph formatting')

    const sentences = formattedText.split(/(?<=[.!?;])\s+/)
    let basicParagraphs = []
    let currentPara = ''

    for (let i = 0; i < sentences.length; i++) {
      currentPara += sentences[i] + ' '
      if ((i + 1) % 4 === 0 || currentPara.length > 400) {
        basicParagraphs.push(`<p>${currentPara.trim()}</p>`)
        currentPara = ''
      }
    }
    if (currentPara.trim()) {
      basicParagraphs.push(`<p>${currentPara.trim()}</p>`)
    }
    finalHtml = basicParagraphs.join('\n')
  }

  finalHtml = finalHtml.replace(/(άρθρ(?:ο|α|ων)|Άρθρ(?:ο|α|ων))\s+(\d+(?:\s*[-,]\s*\d+)*)/gi, '<span class="article-ref">$1 $2</span>')
  finalHtml = finalHtml.replace(/([Νν]\.?\s*\d{3,4}\/\d{4})/g, '<span class="law-ref">$1</span>')
  finalHtml = finalHtml.replace(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g, '<span class="date">$1</span>')
  finalHtml = finalHtml.replace(/(\d{3,5}\/\d{4})/g, '<span class="case-number">$1</span>')

  console.log('Formatting complete, created HTML with length:', finalHtml.length)
  return finalHtml
}

// Helper function to encode filename for Content-Disposition header
function encodeFilenameForHeader(filename: string): string {
  const asciiName = filename.replace(/[^\x00-\x7F]/g, '_')
  const utf8Name = encodeURIComponent(filename).replace(/'/g, '%27')
  return `${asciiName}"; filename*=UTF-8''${utf8Name}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = new Client({
      cloud: { id: process.env.ELASTICSEARCH_CLOUD_ID! },
      auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
    })

    console.log('Fetching document with ID:', params.id)

    // FIXED SECTION - NO THROWING ERRORS
    let source: any
    let allChunks: any[] = []
    let documentFound = false

    // Try to get document directly first
    try {
      const result = await client.get({
        index: 'dev_greek_court',
        id: params.id,
      })
      source = result._source as any
      documentFound = true
      console.log('Document found using direct GET')
    } catch (error) {
      console.log('Direct GET failed for ID:', params.id, 'Will try alternative search methods')
      // Don't throw - continue to alternative search methods
    }

    // If direct GET failed, try searching by _id field
    if (!documentFound) {
      try {
        const searchResult = await client.search({
          index: 'dev_greek_court',
          body: {
            query: {
              term: {
                '_id': params.id
              }
            },
            size: 1
          }
        })
        
        if (searchResult.hits.total && (searchResult.hits.total as any).value > 0) {
          source = searchResult.hits.hits[0]._source as any
          documentFound = true
          console.log('Document found using term search on _id')
        }
      } catch (searchError) {
        console.log('Search by _id also failed')
      }
    }

    // If still not found, try document_id field
    if (!documentFound) {
      try {
        const docIdSearch = await client.search({
          index: 'dev_greek_court',
          body: {
            query: {
              term: {
                'document_id.keyword': params.id
              }
            },
            size: 1
          }
        })
        
        if (docIdSearch.hits.total && (docIdSearch.hits.total as any).value > 0) {
          source = docIdSearch.hits.hits[0]._source as any
          documentFound = true
          console.log('Document found using document_id.keyword field')
        }
      } catch (error) {
        console.log('Search by document_id also failed')
      }
    }

    // If document still not found, return 404
    if (!documentFound) {
      console.error('Document not found after all attempts:', params.id)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    // END OF FIXED SECTION

    // Check if this is a chunked document
    if (params.id.includes('_chunk')) {
      // Extract the base ID (everything before _chunk)
      const baseId = params.id.substring(0, params.id.lastIndexOf('_chunk'))
      console.log('Base document ID:', baseId)
      
      // Search for all chunks using term query on document_id field
      const searchResult = await client.search({
        index: 'dev_greek_court',
        body: {
          query: {
            term: {
              "document_id": baseId + "_chunk000"
            }
          },
          size: 100,
        },
      })

      // If no results with document_id, try searching by prefix on _id
      if (searchResult.hits.hits.length === 0) {
        console.log('No results with document_id, trying prefix search on document_id')
        
        const prefixResult = await client.search({
          index: 'dev_greek_court',
          body: {
            query: {
              bool: {
                must: [
                  {
                    prefix: {
                      "document_id.keyword": baseId
                    }
                  }
                ]
              }
            },
            size: 100,
            sort: [{ "document_id.keyword": 'asc' }],
          },
        })
        
        allChunks = (prefixResult.hits.hits as any[])
          .map((hit) => ({
            id: hit._id,
            ...hit._source,
          }))
          .sort((a, b) => {
            const aNum = parseInt(a.document_id?.match(/_chunk(\d+)$/)?.[1] || '0')
            const bNum = parseInt(b.document_id?.match(/_chunk(\d+)$/)?.[1] || '0')
            return aNum - bNum
          })
      } else {
        allChunks = (searchResult.hits.hits as any[])
          .map((hit) => ({
            id: hit._id,
            ...hit._source,
          }))
          .sort((a, b) => {
            const aNum = parseInt(a.document_id?.match(/_chunk(\d+)$/)?.[1] || '0')
            const bNum = parseInt(b.document_id?.match(/_chunk(\d+)$/)?.[1] || '0')
            return aNum - bNum
          })
      }

      // UPDATED: Combine all chunk texts with CORRECTED priority
      if (allChunks.length > 1) {
        const combinedText = allChunks
          .map(chunk => chunk.chunk_text || chunk.full_text || '') // FIXED: chunk_text first
          .join('\n\n')
        
        source.full_text = combinedText
        source.chunk_count = allChunks.length
        console.log(`Combined ${allChunks.length} chunks into complete document`)
      } else {
        source = allChunks[0] || source
      }
    }

    // UPDATED: Always return the text content as HTML with CORRECTED priority
    // Now prioritizes chunk_text to align with our retriever
    const fullTextContent =
      source.chunk_text ||              // UPDATED: chunk_text is now PRIMARY
      source.full_text ||               // UPDATED: full_text is now secondary  
      source.summary_ai_generated ||
      'Το περιεχόμενο δεν είναι διαθέσιμο'

    console.log('Text content length:', fullTextContent.length)
    console.log('Content source priority check:', {
      chunk_text_available: !!source.chunk_text,
      chunk_text_length: source.chunk_text ? source.chunk_text.length : 0,
      full_text_available: !!source.full_text,
      full_text_length: source.full_text ? source.full_text.length : 0,
      using_field: source.chunk_text ? 'chunk_text' : source.full_text ? 'full_text' : 'summary_ai_generated'
    })
    console.log('Line breaks in content:', (fullTextContent.match(/\n/g) || []).length)

    const formattedContent = formatCourtDecisionText(fullTextContent)
    
    // Use only the decision number without extracted year
    let decisionTitle = source.decision_number || 'Δικαστική Απόφαση'

    const html = `
      <!DOCTYPE html>
      <html lang="el">
      <head>
        <title>${decisionTitle}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 900px; 
            margin: 0 auto; 
            padding: 20px;
            line-height: 1.8;
            color: #333;
            background: #f5f5f5;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .metadata { 
            background: white; 
            padding: 20px; 
            margin-bottom: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .metadata p { 
            margin: 8px 0; 
            display: flex;
            justify-content: space-between;
          }
          .metadata strong {
            color: #555;
            min-width: 150px;
          }
          .chunk-info {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
          }
          .chunk-info strong {
            margin-right: 10px;
          }
          .content { 
            padding: 30px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .content h2.section-header {
            color: #667eea;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 10px;
            margin-top: 30px;
            margin-bottom: 20px;
            font-size: 20px;
            font-weight: 600;
          }
          .content h3.numbered-item {
            color: #764ba2;
            font-size: 16px;
            margin-top: 20px;
            margin-bottom: 15px;
            font-weight: 500;
          }
          .content p {
            margin: 15px 0;
            text-align: justify;
            font-size: 15px;
            line-height: 1.8;
          }
          .content ul.decision-list {
            margin: 15px 0;
            padding-left: 30px;
          }
          .content li.list-item {
            margin: 10px 0;
            font-size: 15px;
          }
          .content blockquote.quoted-text {
            background: #f9f9f9;
            border-left: 3px solid #667eea;
            margin: 20px 0;
            padding: 15px 20px;
            font-style: italic;
            color: #555;
          }
          .article-ref {
            color: #0066cc;
            font-weight: 500;
          }
          .law-ref {
            color: #008800;
            font-weight: 500;
          }
          .date {
            color: #d35400;
            font-weight: 500;
          }
          .case-number {
            color: #8b008b;
            font-weight: 500;
          }
          .content h2.section-header:first-child {
            margin-top: 0;
          }
          @media (max-width: 768px) {
            body {
              padding: 10px;
            }
            .content {
              padding: 20px;
            }
          }
          @media print {
            body {
              background: white;
            }
            .header {
              background: none;
              color: black;
              border: 2px solid #667eea;
            }
            .header h1 {
              color: #667eea;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Δικαστική Απόφαση: ${decisionTitle}</h1>
        </div>
        
        ${source.chunk_count > 1 ? `
        <div class="chunk-info">
          <strong>ℹ️ Σημείωση:</strong> <span>Αυτό το έγγραφο αποτελείται από ${source.chunk_count} τμήματα που έχουν συνδυαστεί για την πλήρη προβολή.</span>
        </div>
        ` : ''}
        
        <div class="content">
          ${formattedContent}
        </div>
      </body>
      </html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
}
