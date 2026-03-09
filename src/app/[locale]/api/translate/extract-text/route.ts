import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import WordExtractor from 'word-extractor'

/**
 * POST /api/translate/extract-text
 *
 * Extracts plain text from uploaded files (DOCX, DOC, PDF, TXT).
 * Accepts multipart form data with a single file.
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

    const fileName = file.name.toLowerCase()
    let text = ''

    if (fileName.endsWith('.txt')) {
      text = await file.text()
    } else if (fileName.endsWith('.docx')) {
      text = await parseDocx(file)
    } else if (fileName.endsWith('.doc')) {
      text = await parseDoc(file)
    } else if (fileName.endsWith('.pdf')) {
      text = await parsePdf(file)
    } else {
      return Response.json(
        { error: 'Unsupported file type. Supported: .txt, .docx, .doc, .pdf' },
        { status: 400 },
      )
    }

    // Clean up extracted text
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (!text) {
      return Response.json(
        { error: 'No text content could be extracted from the file' },
        { status: 400 },
      )
    }

    return Response.json({
      text,
      fileName: file.name,
      charCount: text.length,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Text extraction failed'
    console.error('[translate/extract-text]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

async function parseDocx(file: File): Promise<string> {
  const blob = new Blob([await file.arrayBuffer()], { type: file.type })
  const loader = new DocxLoader(blob)
  const docs = await loader.load()
  return docs.map((d) => d.pageContent).join('\n\n')
}

async function parseDoc(file: File): Promise<string> {
  try {
    const extractor = new WordExtractor()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const doc = await extractor.extract(buffer)
    return doc.getBody()
  } catch {
    // Fallback: try DocxLoader in case it's a misnamed .docx
    return parseDocx(file)
  }
}

async function parsePdf(file: File): Promise<string> {
  const blob = new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
  const loader = new PDFLoader(blob)
  const docs = await loader.load()
  return docs.map((d) => d.pageContent).join('\n\n')
}
