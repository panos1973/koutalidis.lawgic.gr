// /api/documents/law/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@elastic/elasticsearch'

// Create Elasticsearch client
const getElasticsearchClient = () => {
  return new Client({
    cloud: { id: process.env.ELASTICSEARCH_CLOUD_ID! },
    auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
  })
}

function encodeFilenameForHeader(filename: string): string {
  if (!filename) return 'law.pdf'
  
  return filename
    .replace(/[^\x00-\x7F]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_') 
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'law.pdf'
}

// Enhanced function to remove boilerplate text from government documents
function removeBoilerplateText(text: string): string {
  if (!text) return text

  console.log('Removing boilerplate text from document')

  // Remove digital signature blocks with Greek text
  text = text.replace(
    /ΨΗΦΙΑΚΑ\s+ΥΠΟΓΕΓΡΑΜΜΕΝΟ\s+ΑΠΟ[\s\S]*?(?=\n\n|\n[Α-Ω]|$)/gi,
    ''
  )
  
  // Remove any variations of digitally signed text
  text = text.replace(
    /Ψηφιακά\s+υπογεγραμμένο\s+από[\s\S]*?(?=\n\n|\n[Α-Ω]|$)/gi,
    ''
  )
  
  // Remove English digital signature blocks
  text = text.replace(
    /Signature\s+Not\s+Verified[\s\S]*?Location:[\s\S]*?(?=\n\n|\n[Α-Ω]|$)/gi,
    ''
  )
  
  text = text.replace(
    /Digitally\s+signed\s+by[\s\S]*?Reason:[\s\S]*?Location:[\s\S]*?(?=\n\n|\n[Α-Ω]|$)/gi,
    ''
  )

  // Remove asterisk-wrapped document identifiers
  text = text.replace(/\*\d{14,20}\*/g, '')

  // Remove "ΕΦΗΜΕΡΙΔΑ ΤΗΣ ΚΥΒΕΡΝΗΣΕΩΣ" header and complete sentences containing it
  text = text.replace(
    /^.*ΕΦΗΜΕΡΙ[ΔD]Α\s+ΤΗΣ\s+ΚΥΒΕΡΝΗΣΕΩΣ.*$/gim,
    ''
  )
  
  // Remove standalone instances
  text = text.replace(
    /Ε\s*ΕΦΗΜΕΡΙ[ΔD]Α\s+ΤΗΣ\s+ΚΥΒΕΡΝΗΣΕΩΣ\s+ΤΗΣ\s+ΕΛΛΗΝΙΚΗΣ\s+[ΔD]ΗΜΟΚΡΑΤΙΑΣ/gi,
    ''
  )

  // National Printing Office (Εθνικό Τυπογραφείο) boilerplate sections
  const nationalPrintingOfficePatterns = [
    // Main description of National Printing Office
    /Το\s+Εθνικό\s+Τυπογραφείο\s+αποτελεί[\s\S]*?(?:ν\.\s*\d+\/\d+[^)]*\))/gi,
    
    // FEK distribution information
    /ΦΥΛΛΟ\s+ΤΗΣ\s+ΕΦΗΜΕΡΙΔΑΣ\s+ΤΗΣ\s+ΚΥΒΕΡΝΗΣΕΩΣ\s+\(ΦΕΚ\)[\s\S]*?διατίθεται\s+δωρεάν/gi,
    
    // Detailed FEK information section
    /•\s*Τα\s+ΦΕΚ\s+σε\s+ηλεκτρονική\s+μορφή[\s\S]*?Τμήματος\s+Πωλήσεων\s+και\s+Συνδρομητών\./gi,
    
    // Pricing information
    /Τ?το\s+κόστος\s+ενός\s+(?:ασπρόμαυρου|έγχρωμου)\s+ΦΕΚ[\s\S]*?(?:€\s*\d+[,.]?\d*|\d+[,.]?\d*\s*€)/gi,
  ]

  nationalPrintingOfficePatterns.forEach(pattern => {
    text = text.replace(pattern, '')
  })

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]{2,}/g, ' ')
  text = text.trim()

  return text
}

// Function to format law text
function formatLawText(text: string): string {
  if (!text) return '<p>Το περιεχόμενο δεν είναι διαθέσιμο</p>'

  // First remove boilerplate text
  let formattedText = removeBoilerplateText(text)

  // Rest of the formatting logic remains the same
  formattedText = formattedText
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')

  // Format section headers
  formattedText = formattedText.replace(
    /^(ΚΕΦΑΛΑΙΟ|ΤΜΗΜΑ|ΜΕΡΟΣ|ΤΙΤΛΟΣ)\s+([Α-Ω]+|\d+)[:\s]*(.*)$/gm,
    '<h2 class="section-header">$1 $2: $3</h2>'
  )

  // Format article headers
  formattedText = formattedText.replace(
    /^Άρθρο\s+(\d+[α-ω]?)[\s:]*(.*)$/gm,
    '<h3 class="article-header">Άρθρο $1: $2</h3>'
  )

  // Format paragraphs
  formattedText = formattedText.replace(
    /^(\d+)\.\s+(.*)$/gm,
    '<h4 class="paragraph-header">$1. $2</h4>'
  )

  // Convert remaining text to paragraphs
  const lines = formattedText.split('\n')
  let finalHtml = ''
  let currentParagraph = ''

  for (const line of lines) {
    if (line.match(/^<[hH][2-5]/)) {
      if (currentParagraph) {
        finalHtml += `<p>${currentParagraph}</p>\n`
        currentParagraph = ''
      }
      finalHtml += line + '\n'
    } else if (line.trim()) {
      currentParagraph += (currentParagraph ? ' ' : '') + line.trim()
    } else if (currentParagraph) {
      finalHtml += `<p>${currentParagraph}</p>\n`
      currentParagraph = ''
    }
  }

  if (currentParagraph) {
    finalHtml += `<p>${currentParagraph}</p>\n`
  }

  return finalHtml || '<p>Το περιεχόμενο δεν είναι διαθέσιμο</p>'
}

// Error HTML response
function errorHtml(id: string): string {
  return `
    <!DOCTYPE html>
    <html lang="el">
    <head>
      <title>Σφάλμα - Έγγραφο Δεν Βρέθηκε</title>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 600px; 
          margin: 100px auto; 
          padding: 20px;
          text-align: center;
        }
        h1 { color: #dc3545; }
        p { color: #666; margin: 20px 0; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>⚠️ Το έγγραφο δεν βρέθηκε</h1>
      <p>Το έγγραφο με ID <strong>${id}</strong> δεν υπάρχει στη βάση δεδομένων.</p>
      <p><a href="javascript:history.back()">← Επιστροφή</a></p>
    </body>
    </html>
  `
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = getElasticsearchClient()
    
    console.log('Fetching law document with ID:', params.id)

    // Search for the document by chunk_id or _id
    const result = await client.search({
      index: 'greek_laws_collection',
      body: {
        query: {
          bool: {
            should: [
              { term: { _id: params.id } },
              { term: { 'metadata.chunk_id': params.id } },
              { term: { 'chunk_id': params.id } }
            ]
          }
        },
        size: 1
      }
    })

    if (!result.hits.hits || result.hits.hits.length === 0) {
      console.log('No document found with ID:', params.id)
      return new NextResponse(errorHtml(params.id), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const source = result.hits.hits[0]._source as any
    const metadata = source.metadata || {}

    console.log('Document found, metadata keys:', {
      hasMetadata: !!metadata,
      metadataKeys: metadata ? Object.keys(metadata) : [],
      hasPdfUrl: !!metadata.PDF_URL,
      pdfUrl: metadata.PDF_URL,
      hasPdfBlob: !!source.pdf_blob
    })

    // If we have a PDF blob, serve it
    if (source.pdf_blob) {
      console.log('Serving PDF from blob')
      const pdfBuffer = Buffer.from(source.pdf_blob, 'base64')
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${encodeFilenameForHeader(
            metadata.File_Name || metadata.file_name || 'law.pdf'
          )}"`,
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // Helper to extract first element from elasticsearch arrays
    const getValue = (value: any) => Array.isArray(value) ? value[0] : value

    // Get the text content from various possible fields
    const textContent =
      source.pageContent ||
      source.fullText ||
      source.full_text ||
      source.text ||
      metadata.full_text ||
      metadata.content ||
      getValue(metadata.summary) ||
      'Το περιεχόμενο δεν είναι διαθέσιμο'

    console.log('Text content length:', textContent.length)

    // Format the text content with boilerplate removal
    const formattedContent = formatLawText(textContent)
    
    // Get PDF URL - check both metadata.PDF_URL and metadata.pdf_url
    const pdfUrl = getValue(metadata.PDF_URL) || getValue(metadata.pdf_url)
    const validPdfUrl = pdfUrl && pdfUrl !== 'N/A' ? pdfUrl : null

    // Generate the HTML response - REMOVED the court field
    const html = `
      <!DOCTYPE html>
      <html lang="el">
      <head>
        <title>${getValue(metadata.title) || getValue(metadata.law_title) || 'Νομοθεσία'}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * {
            box-sizing: border-box;
          }
          
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
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          
          .header .law-number {
            font-size: 18px;
            opacity: 0.95;
            margin-top: 5px;
          }
          
          .metadata { 
            background: white; 
            padding: 20px; 
            margin-bottom: 20px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          
          .metadata p { 
            margin: 8px 0; 
            display: flex;
            align-items: baseline;
          }
          
          .metadata p strong { 
            color: #495057;
            min-width: 150px;
            margin-right: 10px;
          }
          
          .metadata p span {
            color: #212529;
          }
          
          .content {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          
          .content h2.section-header {
            color: #28a745;
            font-size: 20px;
            margin-top: 30px;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e9ecef;
          }
          
          .content h3.article-header {
            color: #495057;
            font-size: 18px;
            margin-top: 25px;
            margin-bottom: 10px;
            padding-left: 10px;
            border-left: 3px solid #28a745;
          }
          
          .content h4.paragraph-header {
            color: #6c757d;
            font-size: 16px;
            margin-top: 15px;
            margin-bottom: 8px;
            font-weight: 600;
          }
          
          .content p {
            text-align: justify;
            margin: 10px 0;
          }
          
          .pdf-link {
            background: #e8f4fd;
            border: 1px solid #667eea;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          
          .pdf-link a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
          }
          
          .pdf-link a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${getValue(metadata.title) || getValue(metadata.law_title) || 'Νομικό Κείμενο'}</h1>
          ${getValue(metadata.law_number) ? `<div class="law-number">${getValue(metadata.law_number)}</div>` : ''}
        </div>
        
        <div class="metadata">
          ${getValue(metadata.law_number) ? '<p><strong>Αριθμός Νόμου:</strong> <span>' + getValue(metadata.law_number) + '</span></p>' : ''}
          ${getValue(metadata.decision_number) ? '<p><strong>Αριθμός Απόφασης:</strong> <span>' + getValue(metadata.decision_number) + '</span></p>' : ''}
          ${getValue(metadata.date) ? '<p><strong>Ημερομηνία:</strong> <span>' + getValue(metadata.date) + '</span></p>' : ''}
          ${getValue(metadata.legal_field) ? '<p><strong>Νομικός Τομέας:</strong> <span>' + getValue(metadata.legal_field) + '</span></p>' : ''}
          ${getValue(metadata.primary_issue) ? '<p><strong>Θέμα:</strong> <span>' + getValue(metadata.primary_issue) + '</span></p>' : ''}
        </div>
        
        ${validPdfUrl ? 
          '<div class="pdf-link">' +
          '<strong>📄 Πρωτότυπο Κείμενο:</strong> ' +
          '<a href="' + validPdfUrl + '" target="_blank" rel="noopener">Προβολή πλήρους εγγράφου PDF</a>' +
          '</div>'
        : ''}
        
        <div class="content">
          ${formattedContent}
        </div>
        
        <script>
          console.log('Law document loaded successfully');
          console.log('Document structure:', {
            paragraphs: document.querySelectorAll('.content p').length,
            sectionHeaders: document.querySelectorAll('.content h2.section-header').length,
            articleHeaders: document.querySelectorAll('.content h3.article-header').length,
            paragraphHeaders: document.querySelectorAll('.content h4.paragraph-header').length
          });
        </script>
      </body>
      </html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })

  } catch (error) {
    console.error('Error fetching law document:', error)
    return new NextResponse(errorHtml(params.id), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
