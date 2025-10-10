import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@elastic/elasticsearch'

// Create Elasticsearch client
const getElasticsearchClient = () => {
  return new Client({
    cloud: { id: process.env.ELASTICSEARCH_CLOUD_ID! },
    auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = getElasticsearchClient()

    const result = await client.get({
      index: '0825_dev_greek_court',
      id: params.id,
    })

    const source = result._source as any

    if (source.pdf_blob) {
      // Serve the PDF from the blob
      const pdfBuffer = Buffer.from(source.pdf_blob, 'base64')
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${
            source.file_name || 'document.pdf'
          }"`,
        },
      })
    }

    // If no PDF blob, return the text content as HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${source.decision_number || 'Court Decision'}</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
            line-height: 1.6;
          }
          .metadata { 
            background: #f5f5f5; 
            padding: 15px; 
            margin-bottom: 20px;
            border-radius: 8px;
          }
          .metadata p { margin: 5px 0; }
          .content { 
            padding: 20px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
          }
          h1 { color: #333; }
          h2 { color: #555; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Δικαστική Απόφαση: ${source.decision_number || 'N/A'}</h1>
        <div class="metadata">
          <p><strong>Δικαστήριο:</strong> ${
            source.court_name || source.court || 'Άγνωστο'
          }</p>
          <p><strong>Ημερομηνία:</strong> ${
            source.decision_date || 'Άγνωστη'
          }</p>
          <p><strong>Τύπος Υπόθεσης:</strong> ${
            source.case_type || 'Άγνωστος'
          }</p>
          <p><strong>Αρχείο:</strong> ${source.file_name || 'Άγνωστο'}</p>
        </div>
        <div class="content">
          <h2>Περιεχόμενο</h2>
          <pre style="white-space: pre-wrap; font-family: inherit;">
${
  source.full_text ||
  source.chunk_text ||
  source.summary_ai_generated ||
  'Το περιεχόμενο δεν είναι διαθέσιμο'
}
          </pre>
        </div>
      </body>
      </html>
    `

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
}
