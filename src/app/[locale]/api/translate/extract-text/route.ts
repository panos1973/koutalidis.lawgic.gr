import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import WordExtractor from 'word-extractor'
import * as XLSX from 'xlsx'

// Extension → parser mapping
const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.txt': 'text',
  '.md': 'text',
  '.html': 'html',
  '.htm': 'html',
  '.csv': 'csv',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'doc',
  '.rtf': 'rtf',
  '.odt': 'odt',
  '.xls': 'xlsx',
  '.xlsx': 'xlsx',
  '.ppt': 'pptx',
  '.pptx': 'pptx',
  '.eml': 'eml',
  '.msg': 'msg',
}

/**
 * POST /api/translate/extract-text
 *
 * Extracts plain text from uploaded files.
 * Supports: TXT, MD, HTML, CSV, PDF, DOCX, DOC, RTF, ODT,
 *           XLS, XLSX, PPT, PPTX, EML, MSG
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
    const ext = fileName.slice(fileName.lastIndexOf('.'))
    const parserType = SUPPORTED_EXTENSIONS[ext]

    if (!parserType) {
      const supported = Object.keys(SUPPORTED_EXTENSIONS).join(', ')
      return Response.json(
        { error: `Unsupported file type "${ext}". Supported: ${supported}` },
        { status: 400 },
      )
    }

    let text = ''

    switch (parserType) {
      case 'text':
        text = await file.text()
        break
      case 'html':
        text = await parseHtml(file)
        break
      case 'csv':
        text = await parseCsv(file)
        break
      case 'pdf':
        text = await parsePdf(file)
        break
      case 'docx':
        text = await parseDocx(file)
        break
      case 'doc':
        text = await parseDoc(file)
        break
      case 'rtf':
        text = await parseRtf(file)
        break
      case 'odt':
        text = await parseOdt(file)
        break
      case 'xlsx':
        text = await parseXlsx(file)
        break
      case 'pptx':
        text = await parsePptx(file)
        break
      case 'eml':
        text = await parseEml(file)
        break
      case 'msg':
        text = await parseMsg(file)
        break
      default:
        text = await file.text()
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

// ─── Parsers ────────────────────────────────────────────────────────

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

async function parseCsv(file: File): Promise<string> {
  const blob = new Blob([await file.arrayBuffer()], { type: 'text/csv' })
  const loader = new CSVLoader(blob)
  const docs = await loader.load()
  return docs.map((d) => d.pageContent).join('\n')
}

async function parseHtml(file: File): Promise<string> {
  const html = await file.text()
  // Strip HTML tags, decode entities, preserve structure
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<td[^>]*>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

async function parseRtf(file: File): Promise<string> {
  const rtf = await file.text()
  // Strip RTF control words and groups, keep plain text
  return rtf
    .replace(/\{\\fonttbl[\s\S]*?\}/g, '')
    .replace(/\{\\colortbl[\s\S]*?\}/g, '')
    .replace(/\{\\stylesheet[\s\S]*?\}/g, '')
    .replace(/\{\\info[\s\S]*?\}/g, '')
    .replace(/\\par\b/g, '\n')
    .replace(/\\line\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\u(\d+)\??/g, (_m, code) =>
      String.fromCharCode(parseInt(code, 10)),
    )
    .replace(/\\[a-z]+\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
}

async function parseOdt(file: File): Promise<string> {
  // ODT is a ZIP containing content.xml — try DocxLoader which handles OOXML,
  // or fall back to extracting XML text content
  try {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    const loader = new DocxLoader(blob)
    const docs = await loader.load()
    return docs.map((d) => d.pageContent).join('\n\n')
  } catch {
    // Manual XML extraction from the ZIP
    const arrayBuffer = await file.arrayBuffer()
    const text = new TextDecoder().decode(arrayBuffer)
    // Try to extract text from XML content
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  }
}

async function parseXlsx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheets: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const text = XLSX.utils.sheet_to_txt(sheet)
    if (text.trim()) {
      sheets.push(`--- ${sheetName} ---\n${text}`)
    }
  }

  return sheets.join('\n\n')
}

async function parsePptx(file: File): Promise<string> {
  // PPTX is a ZIP with XML slides — extract text from slide XML
  const arrayBuffer = await file.arrayBuffer()
  try {
    // Use xlsx library to read as generic OOXML (it can parse PPTX structure)
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheets: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const text = XLSX.utils.sheet_to_txt(sheet)
      if (text.trim()) sheets.push(text)
    }
    if (sheets.length > 0) return sheets.join('\n\n')
  } catch {
    // Fall through to manual extraction
  }

  // Fallback: extract any readable text from the binary
  const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer)
  // Extract text between XML tags
  const textContent = text
    .match(/<a:t>([^<]+)<\/a:t>/g)
    ?.map((t) => t.replace(/<\/?a:t>/g, ''))
    .join(' ') || ''

  if (textContent.trim()) return textContent

  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

async function parseEml(file: File): Promise<string> {
  const raw = await file.text()

  // Parse EML: extract headers + body
  const parts: string[] = []

  // Extract key headers
  const subjectMatch = raw.match(/^Subject:\s*(.+)$/mi)
  const fromMatch = raw.match(/^From:\s*(.+)$/mi)
  const toMatch = raw.match(/^To:\s*(.+)$/mi)
  const dateMatch = raw.match(/^Date:\s*(.+)$/mi)

  if (subjectMatch) parts.push(`Subject: ${subjectMatch[1].trim()}`)
  if (fromMatch) parts.push(`From: ${fromMatch[1].trim()}`)
  if (toMatch) parts.push(`To: ${toMatch[1].trim()}`)
  if (dateMatch) parts.push(`Date: ${dateMatch[1].trim()}`)

  // Extract body (after first blank line)
  const bodyStart = raw.indexOf('\n\n')
  if (bodyStart !== -1) {
    let body = raw.slice(bodyStart + 2)

    // Strip MIME boundaries and headers for multipart messages
    body = body
      .replace(/--[\w=-]+/g, '')
      .replace(/Content-Type:.*\n/gi, '')
      .replace(/Content-Transfer-Encoding:.*\n/gi, '')
      .replace(/Content-Disposition:.*\n/gi, '')
      // Strip HTML if present
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (body) parts.push(`\n${body}`)
  }

  return parts.join('\n')
}

async function parseMsg(file: File): Promise<string> {
  // MSG is a binary OLE2 format — extract what text we can
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // Try to find Unicode text strings in the binary
  const texts: string[] = []
  let current = ''

  for (let i = 0; i < bytes.length - 1; i += 2) {
    const charCode = bytes[i] | (bytes[i + 1] << 8)
    if (charCode >= 32 && charCode < 65535 && charCode !== 65534) {
      const char = String.fromCharCode(charCode)
      if (/[a-zA-Z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\s.,;:!?'"()\-\/]/.test(char)) {
        current += char
      } else if (current.length > 0) {
        if (current.trim().length > 10) texts.push(current.trim())
        current = ''
      }
    } else {
      if (current.trim().length > 10) texts.push(current.trim())
      current = ''
    }
  }
  if (current.trim().length > 10) texts.push(current.trim())

  // Deduplicate and join
  const unique = [...new Set(texts)]
  return unique.join('\n\n') || 'Could not extract text from MSG file. Please save as EML and try again.'
}
