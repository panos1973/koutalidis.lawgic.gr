import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import PizZip from 'pizzip'

/**
 * POST /api/translate/docx-extract
 *
 * Extracts paragraph text from a DOCX file while preserving the exact text
 * as it appears in the XML (for later replacement). Also converts the DOCX
 * to simple HTML preview using mammoth (client will handle docx-preview).
 *
 * Returns:
 * - paragraphs: Array of paragraph texts (as they appear in the OOXML)
 * - docxBase64: The original file as base64 (for later docx-translate call)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const docxBase64 = buffer.toString('base64')

    // Extract paragraphs from document.xml
    const zip = new PizZip(buffer)
    const paragraphs = extractParagraphs(zip)

    return Response.json({
      paragraphs,
      docxBase64,
      fileName: file.name,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'DOCX extraction failed'
    console.error('[translate/docx-extract]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * Extract paragraph texts from OOXML document.xml, headers, and footers.
 * Each paragraph is the concatenation of all <w:t> elements within a <w:p>.
 */
function extractParagraphs(zip: PizZip): string[] {
  const paragraphs: string[] = []

  // Process document.xml (main body)
  const docXml = zip.file('word/document.xml')
  if (docXml) {
    paragraphs.push(...extractParagraphsFromXml(docXml.asText()))
  }

  return paragraphs
}

function extractParagraphsFromXml(xml: string): string[] {
  const paragraphs: string[] = []

  // Match each <w:p ...>...</w:p>
  const pRegex = /<w:p[ >][\s\S]*?<\/w:p>/g
  let pMatch: RegExpExecArray | null

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const paragraphXml = pMatch[0]

    // Extract text from <w:t> elements
    const textParts: string[] = []
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
    let tMatch: RegExpExecArray | null

    while ((tMatch = tRegex.exec(paragraphXml)) !== null) {
      textParts.push(tMatch[1])
    }

    const text = textParts.join('')
    if (text.trim()) {
      paragraphs.push(text)
    }
  }

  return paragraphs
}
