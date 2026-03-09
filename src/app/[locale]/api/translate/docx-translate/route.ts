import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import PizZip from 'pizzip'

/**
 * POST /api/translate/docx-translate
 *
 * Accepts an original DOCX file (as base64) plus the paragraph-level translations,
 * and produces a new DOCX with text replaced while preserving all formatting.
 *
 * The approach: unzip DOCX → parse word/document.xml → walk <w:p> paragraphs →
 * replace <w:t> text content with translated text → re-zip.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { docxBase64, paragraphMap } = body as {
      docxBase64: string
      paragraphMap: Array<{ original: string; translated: string }>
    }

    if (!docxBase64 || !paragraphMap || paragraphMap.length === 0) {
      return Response.json(
        { error: 'docxBase64 and paragraphMap are required' },
        { status: 400 },
      )
    }

    const binaryContent = Buffer.from(docxBase64, 'base64')
    const zip = new PizZip(binaryContent)

    // Process document.xml, headers, and footers
    const xmlFiles = Object.keys(zip.files).filter(
      (name) =>
        name === 'word/document.xml' ||
        name.match(/^word\/header\d*\.xml$/) ||
        name.match(/^word\/footer\d*\.xml$/),
    )

    for (const xmlFileName of xmlFiles) {
      const xmlFile = zip.file(xmlFileName)
      if (!xmlFile) continue

      let xml = xmlFile.asText()
      xml = replaceTranslations(xml, paragraphMap)
      zip.file(xmlFileName, xml)
    }

    const updatedBuffer = zip.generate({
      type: 'nodebuffer',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const base64Result = updatedBuffer.toString('base64')

    return Response.json({ docxBase64: base64Result })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'DOCX translation failed'
    console.error('[translate/docx-translate]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * Replace paragraph text in OOXML while preserving all formatting.
 *
 * Strategy:
 * 1. Find each <w:p>...</w:p> block
 * 2. Extract the combined text from all <w:t> elements in that paragraph
 * 3. Look up the translation for that paragraph text
 * 4. Replace the text across the <w:t> elements:
 *    - Put the full translated text in the first <w:t>
 *    - Empty out the remaining <w:t> elements
 *    This preserves the run structure and formatting of the first run.
 */
function replaceTranslations(
  xml: string,
  paragraphMap: Array<{ original: string; translated: string }>,
): string {
  // Build a lookup map: normalized original text → translated text
  const lookup = new Map<string, string>()
  for (const entry of paragraphMap) {
    const key = normalizeText(entry.original)
    if (key && entry.translated.trim()) {
      lookup.set(key, entry.translated)
    }
  }

  if (lookup.size === 0) return xml

  // Match each <w:p ...>...</w:p> paragraph
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraphXml) => {
    // Extract all <w:t> text content from this paragraph
    const textParts: string[] = []
    paragraphXml.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_match, text) => {
      textParts.push(text)
      return _match
    })

    const combinedText = textParts.join('')
    const normalizedCombined = normalizeText(combinedText)

    if (!normalizedCombined || !lookup.has(normalizedCombined)) {
      return paragraphXml
    }

    const translation = lookup.get(normalizedCombined)!

    // Replace: put full translated text in first <w:t>, empty the rest
    let isFirst = true
    const replaced = paragraphXml.replace(
      /<w:t([^>]*)>([^<]*)<\/w:t>/g,
      (match, attrs) => {
        if (isFirst) {
          isFirst = false
          // Ensure xml:space="preserve" so whitespace is kept
          const spaceAttr = attrs.includes('xml:space')
            ? attrs
            : ` xml:space="preserve"${attrs}`
          return `<w:t${spaceAttr}>${escapeXml(translation)}</w:t>`
        }
        // Empty subsequent text runs
        return `<w:t${attrs}></w:t>`
      },
    )

    return replaced
  })
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
