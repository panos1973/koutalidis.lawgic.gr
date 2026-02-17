import { NextRequest, NextResponse } from 'next/server'
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { createWorker } from 'tesseract.js'
import Anthropic from '@anthropic-ai/sdk'
import WordExtractor from 'word-extractor'

/**
 * Interface for file parsing result with token count
 */
interface FileParseResult {
  fileName: string
  content: string
  tokenCount: number
  fileType: string
  error?: string
}

/**
 * Interface for Anthropic token count response
 */
interface AnthropicTokenCountResponse {
  input_tokens: number
}

/**
 * Interface for API request body
 */
interface TokenCountRequest {
  files: (string | { data: string; name: string; type: string })[]
  model?: string
}

/**
 * Interface for API response
 */
interface TokenCountResponse {
  totalTokens: number
  files: {
    fileName: string
    tokenCount: number
    fileType: string
    error?: string
  }[]
}

/**
 * Determines the file type from a URL or file object
 */
const getFileType = (input: string | { type: string }): string => {
  if (typeof input === 'string') {
    // Extract file extension from URL
    const url = new URL(input)
    const pathname = url.pathname.toLowerCase()
    if (pathname.endsWith('.pdf')) return 'application/pdf'
    if (pathname.endsWith('.docx'))
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (pathname.endsWith('.doc')) return 'application/msword'
    if (pathname.endsWith('.csv')) return 'text/csv'
    if (pathname.endsWith('.txt')) return 'text/plain'
    if (pathname.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image/jpeg'
    return 'unknown'
  }
  return input.type
}

/**
 * Converts URL to blob
 */
const urlToBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${response.statusText}`)
  }
  return response.blob()
}

/**
 * Converts base64 data to blob
 */
const base64ToBlob = (base64Data: string, type: string): Blob => {
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type })
}

/**
 * Logs the first few words of extracted content for debugging
 */
const logExtractedContent = (fileName: string, content: string): void => {
  const words = content.trim().split(/\s+/).slice(0, 10)
  const preview = words.join(' ')
  console.log(
    `📄 Extracted content from ${fileName}: "${preview}${
      words.length === 10 ? '...' : ''
    }"`
  )
  console.log(`📊 Total content length: ${content.length} characters`)
}

/**
 * Parse PDF content
 */
async function parsePdf(blob: Blob): Promise<string> {
  const loader = new PDFLoader(blob)
  const docs = await loader.load()
  return docs.map((doc) => doc.pageContent).join('\n')
}

/**
 * Parse DOCX content
 */
async function parseDocx(blob: Blob): Promise<string> {
  const loader = new DocxLoader(blob)
  const docs = await loader.load()
  return docs.map((doc) => doc.pageContent).join('\n')
}

/**
 * Parse legacy DOC content using word-extractor
 * Supports both traditional OLE-based .doc and modern .docx files
 */
async function parseDoc(blob: Blob): Promise<string> {
  try {
    const extractor = new WordExtractor()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const extracted = await extractor.extract(buffer)
    const text = extracted.getBody()

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in .doc file')
    }

    return text
  } catch (error) {
    // If word-extractor fails, try DocxLoader in case it's a misnamed .docx file
    try {
      console.log(
        '📝 word-extractor failed, trying DocxLoader for potential misnamed .docx file...'
      )
      return await parseDocx(blob)
    } catch (docxError) {
      throw new Error(
        `Unable to extract text from .doc file. ${
          error instanceof Error ? error.message : 'Unknown error'
        }. ` +
          'Please ensure the file is not corrupted or consider converting to .docx format.'
      )
    }
  }
}

/**
 * Parse CSV content
 */
async function parseCsv(blob: Blob): Promise<string> {
  const loader = new CSVLoader(blob)
  const docs = await loader.load()
  return docs.map((doc) => doc.pageContent).join('\n')
}

/**
 * Parse TXT content with enhanced handling
 */
async function parseTxt(blob: Blob): Promise<string> {
  try {
    // Try using TextLoader first
    const loader = new TextLoader(blob)
    const docs = await loader.load()
    return docs.map((doc) => doc.pageContent).join('\n')
  } catch (error) {
    console.log('📝 TextLoader failed, attempting manual text extraction...')

    // Fallback: read as text directly
    const text = await blob.text()
    if (!text || text.trim().length === 0) {
      throw new Error('Text file appears to be empty or unreadable')
    }
    return text
  }
}

/**
 * Extract text from images using OCR
 */
const identifyImage = async (imageUrl: string): Promise<string> => {
  let content = ''
  const worker = await createWorker(['eng', 'ell'])
  const ret = await worker.recognize(imageUrl)
  content = ret.data.text
  await worker.terminate()
  return content
}

/**
 * Cleans and normalizes text content
 */
const cleanContent = (content: string): string => {
  try {
    return content
      .normalize('NFC') // Normalize to Unicode NFC
      .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
      .replace(/\s\s+/g, ' ') // Remove extra spaces
      .trim() // Remove leading and trailing spaces
  } catch (error) {
    console.error('Error cleaning content:', error)
    return content
  }
}

/**
 * Parses content from a blob based on its type
 */
const parseFileContent = async (
  blob: Blob,
  fileType: string,
  fileName: string
): Promise<string> => {
  let content: string

  switch (fileType) {
    case 'application/pdf':
      content = await parsePdf(blob)
      break
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      content = await parseDocx(blob)
      break
    case 'application/msword':
      content = await parseDoc(blob)
      break
    case 'text/csv':
      content = await parseCsv(blob)
      break
    case 'text/plain':
      content = await parseTxt(blob)
      break
    default:
      if (fileType.startsWith('image/')) {
        // Convert blob to data URL for image processing
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        content = await identifyImage(dataUrl)
      } else {
        throw new Error(`Unsupported file type: ${fileType}`)
      }
  }

  // Log the extracted content for debugging
  logExtractedContent(fileName, content)

  return content
}

/**
 * Counts tokens using Anthropic's token counting API
 */
const countTokensWithAnthropic = async (msg: string): Promise<number> => {
  const client = new Anthropic()
  const response = await client.messages.countTokens({
    model: 'claude-sonnet-4-6',
    messages: [
      {
        role: 'user',
        content: msg,
      },
    ],
  })
  return response.input_tokens
}

/**
 * Main POST handler for token counting endpoint
 */
export async function POST(req: NextRequest) {
  try {
    // Get Anthropic API key from environment
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const body: TokenCountRequest = await req.json()
    const { files, model = 'claude-sonnet-4-6' } = body

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Files array is required and must not be empty' },
        { status: 400 }
      )
    }

    const results: FileParseResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      let fileName = ''
      let blob: Blob
      let fileType: string = 'unknown'

      try {
        // Handle URL or file object
        if (typeof file === 'string') {
          fileName = file.split('/').pop() || `file-${i + 1}`
          fileType = getFileType(file)
          blob = await urlToBlob(file)
        } else {
          fileName = file.name || `file-${i + 1}`
          fileType = getFileType(file)
          // Convert base64 data to blob
          blob = base64ToBlob(file.data, file.type)
        }

        console.log(`🔄 Processing file: ${fileName} (${fileType})`)

        // Parse file content
        const content = await parseFileContent(blob, fileType, fileName)
        const cleanedContent = cleanContent(content)

        // Count tokens using Anthropic API
        const tokenCount = await countTokensWithAnthropic(cleanedContent)

        console.log(
          `✅ Successfully processed ${fileName}: ${tokenCount} tokens`
        )

        results.push({
          fileName,
          content: cleanedContent,
          tokenCount,
          fileType,
        })
      } catch (error) {
        console.error(`❌ Error processing file ${fileName}:`, error)
        results.push({
          fileName: fileName || `file-${i + 1}`,
          content: '',
          tokenCount: 0,
          fileType: fileType || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Calculate total tokens
    const totalTokens = results.reduce(
      (total, result) => total + result.tokenCount,
      0
    )

    console.log(`📊 Total tokens across all files: ${totalTokens}`)

    // Prepare simplified response
    const response: TokenCountResponse = {
      totalTokens,
      files: results.map((result) => ({
        fileName: result.fileName,
        tokenCount: result.tokenCount,
        fileType: result.fileType,
        ...(result.error && { error: result.error }),
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error in token count endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
