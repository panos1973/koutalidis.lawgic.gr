// app/api/export-chat/route.ts - SIMPLIFIED VERSION
import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ExternalHyperlink,
} from 'docx'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ExportRequest {
  messages: Message[]
  locale?: string
}

// Simplified text parsing - handles links, bold, italic
const parseText = (text: string, isQuestion: boolean): (TextRun | ExternalHyperlink)[] => {
  const textColor = isQuestion ? 'c60430' : '000000'
  const elements: (TextRun | ExternalHyperlink)[] = []
  
  // Handle markdown links [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index)
      elements.push(...parseSimpleFormatting(beforeText, textColor))
    }
    
    // Add the link
    elements.push(
      new ExternalHyperlink({
        children: [
          new TextRun({
            text: match[1],
            color: "0000FF",
            underline: {},
            size: 22,
          }),
        ],
        link: match[2].trim(),
      })
    )
    
    lastIndex = linkRegex.lastIndex
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex)
    elements.push(...parseSimpleFormatting(remainingText, textColor))
  }
  
  return elements.length > 0 ? elements : [new TextRun({ text, color: textColor, size: 22 })]
}

// Simple bold/italic parsing
const parseSimpleFormatting = (text: string, color: string): TextRun[] => {
  const runs: TextRun[] = []
  
  // Split by **bold** and *italic*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g)
  
  parts.forEach((part) => {
    if (!part) return
    
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      runs.push(new TextRun({
        text: part.slice(2, -2),
        bold: true,
        color,
        size: 22,
      }))
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      runs.push(new TextRun({
        text: part.slice(1, -1),
        italics: true,
        color,
        size: 22,
      }))
    } else {
      runs.push(new TextRun({
        text: part,
        color,
        size: 22,
      }))
    }
  })
  
  return runs
}

// Basic content cleaning
const cleanContent = (content: string): string => {
  return content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, '')) // Clean code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
    .trim()
}

// Simple table detection and creation
const createSimpleTable = (lines: string[]): Table | null => {
  const tableLines = lines.filter(line => line.includes('|') && line.trim().length > 0)
  if (tableLines.length < 2) return null
  
  const rows = tableLines.map((line, index) => {
    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0)
    if (cells.length === 0) return null
    
    const isHeader = index === 0
    const tableCells = cells.map(cellText => 
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cellText,
                bold: isHeader,
                color: isHeader ? 'FFFFFF' : '000000',
                size: 22,
              }),
            ],
          }),
        ],
        shading: isHeader ? { type: 'solid' as any, color: '808080' } : undefined,
      })
    )
    
    return new TableRow({ children: tableCells })
  }).filter(row => row !== null)
  
  if (rows.length === 0) return null
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows as TableRow[],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    },
  })
}

// Convert message content to document elements
const convertToDocElements = (content: string, isQuestion: boolean): (Paragraph | Table)[] => {
  const cleanedContent = cleanContent(content)
  const lines = cleanedContent.split('\n')
  const elements: (Paragraph | Table)[] = []
  
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    
    // Skip empty lines
    if (!line) {
      elements.push(new Paragraph({ children: [] }))
      i++
      continue
    }
    
    // Check for table (multiple consecutive lines with |)
    if (line.includes('|')) {
      const tableLines = []
      let j = i
      while (j < lines.length && lines[j].includes('|')) {
        tableLines.push(lines[j])
        j++
      }
      
      if (tableLines.length > 1) {
        const table = createSimpleTable(tableLines)
        if (table) {
          elements.push(table)
          i = j
          continue
        }
      }
    }
    
    // Handle headings
    let textContent = line
    let isHeading = false
    let headingLevel = 0
    
    if (line.startsWith('#### ')) {
      textContent = line.substring(5)
      isHeading = true
      headingLevel = 4
    } else if (line.startsWith('### ')) {
      textContent = line.substring(4)
      isHeading = true
      headingLevel = 3
    } else if (line.startsWith('## ')) {
      textContent = line.substring(3)
      isHeading = true
      headingLevel = 2
    } else if (line.startsWith('# ')) {
      textContent = line.substring(2)
      isHeading = true
      headingLevel = 1
    }
    
    // Create text runs
    const textRuns = parseText(textContent, isQuestion)
    
    // Apply heading formatting
    if (isHeading) {
      const headingSize = headingLevel === 1 ? 26 : headingLevel === 2 ? 24 : 22
      const styledRuns = textRuns.map(run => {
        if (run instanceof ExternalHyperlink) return run
        const textRun = run as TextRun
        return new TextRun({
          text: (textRun as any).text || textContent,
          bold: true,
          color: isQuestion ? 'c60430' : '000000',
          size: headingSize,
        })
      })
      
      elements.push(
        new Paragraph({
          children: styledRuns,
          spacing: { before: 200, after: 100 },
        })
      )
    } else {
      // Regular paragraph
      elements.push(
        new Paragraph({
          children: textRuns,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 50, after: 50 },
        })
      )
    }
    
    i++
  }
  
  return elements
}

export async function POST(request: NextRequest) {
  try {
    const { messages }: ExportRequest = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages data' }, { status: 400 })
    }

    const children: (Paragraph | Table)[] = []
    const filteredMessages = messages.filter((m) => m.content.trim() !== '')

    // Process each message
    filteredMessages.forEach((message, index) => {
      const sender = message.role === 'user' ? 'Ερώτηση' : 'Απάντηση'
      const isQuestion = message.role === 'user'

      // Add header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${sender}:`,
              bold: true,
              color: isQuestion ? 'c60430' : '000000',
              size: 24,
            }),
          ],
          spacing: { before: index === 0 ? 150 : 250, after: 100 },
        })
      )

      // Add content
      const contentElements = convertToDocElements(message.content, isQuestion)
      children.push(...contentElements)

      // Add spacing
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '', size: 22 })],
          spacing: { after: 200 },
        })
      )
    })

    // Create document
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { color: '000000', font: 'Arial', size: 22 },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children: children,
      }],
    })

    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="lawgic_chat_export.docx"',
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error in export API:', error)
    return NextResponse.json(
      { error: 'Failed to generate document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
