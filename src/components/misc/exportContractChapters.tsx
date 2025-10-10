import { Message } from 'ai/react'
import { toast } from 'sonner'
import { saveAs } from 'file-saver'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  ShadingType,
} from 'docx'

interface OrganizedContent {
  nonChapterResponses: Array<{
    originalIndex: number
    content: string
  }>
  chapters: Array<{
    chapterNumber: number
    originalIndex: number
    content: string
  }>
}

export const exportContractChapters = async (
  messages: Message[],
  locale: string
) => {
  // AI-powered organization function
  const organizeContentWithAI = async (
    messages: Message[]
  ): Promise<OrganizedContent | null> => {
    try {
      const response = await fetch(`/${locale}/api/contracts/exportContract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        return null
      }

      const organizedData = await response.json()
      return organizedData
    } catch (error) {
      console.error('Failed to organize content with AI:', error)
      return null
    }
  }

  // Fallback organization function
  const organizeContentFallback = (messages: Message[]): OrganizedContent => {
    const assistantResponses = messages
      .filter((msg) => msg.role === 'assistant' && msg.content.trim())
      .map((msg, index) => ({
        originalIndex: index,
        content: cleanContent(msg.content),
      }))

    // Simple fallback
    const chapters: Array<{
      chapterNumber: number
      originalIndex: number
      content: string
    }> = []
    const nonChapterResponses: Array<{
      originalIndex: number
      content: string
    }> = []

    assistantResponses.forEach((response) => {
      const chapterMatch = response.content.match(
        /(?:ΚΕΦΑΛΑΙΟ|CHAPTER)\s+(\d+)/i
      )
      if (chapterMatch) {
        chapters.push({
          chapterNumber: parseInt(chapterMatch[1]),
          originalIndex: response.originalIndex,
          content: response.content,
        })
      } else {
        nonChapterResponses.push(response)
      }
    })

    // Sort chapters by number
    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber)

    return { nonChapterResponses, chapters }
  }

  const parseMarkdownTable = (
    content: string
  ): Array<{
    isTable: boolean
    content: string | string[][]
  }> => {
    const lines = content.split('\n')
    const result: Array<{ isTable: boolean; content: string | string[][] }> = []
    let currentText = ''
    let inTable = false
    let tableRows: string[][] = []

    // Function to clean a cell by removing consecutive dashes (3 or more) and other meaningless patterns
    const cleanCell = (cell: string): string => {
      let cleaned = cell.trim()

      // Remove consecutive dashes (3 or more)
      cleaned = cleaned.replace(/-{3,}/g, '')

      // Remove consecutive dots (3 or more)
      cleaned = cleaned.replace(/\.{3,}/g, '')

      // Remove consecutive underscores (3 or more)
      cleaned = cleaned.replace(/_{3,}/g, '')

      // Remove other meaningless patterns but preserve meaningful content
      cleaned = cleaned.replace(/^\s*[\-\.\s]*\s*$/, '') // Only dashes, dots and spaces

      return cleaned.trim()
    }

    // Function to check if a cleaned cell contains meaningful data
    const hasMeaningfulContent = (cell: string): boolean => {
      const cleaned = cleanCell(cell)
      if (!cleaned) return false

      // ALWAYS keep if it contains any alphanumeric characters
      if (/[a-zA-Z0-9]/.test(cleaned)) {
        return true
      }

      // Specific patterns for common placeholder text (after cleaning)
      const meaninglessPatterns = [
        /^n\/a$/i, // n/a (case insensitive)
        /^na$/i, // na (case insensitive)
        /^null$/i, // null (case insensitive)
        /^empty$/i, // empty (case insensitive)
        /^void$/i, // void (case insensitive)
        /^tbd$/i, // to be determined
        /^tbh$/i, // to be handled
        /^\/+$/, // Any number of forward slashes
        /^\\+$/, // Any number of backslashes
        /^\|+$/, // Any number of pipes
        /^~+$/, // Any number of tildes
        /^`+$/, // Any number of backticks
        /^'+$/, // Any number of single quotes
        /^"+$/, // Any number of double quotes
      ]

      // Check if it matches any meaningless pattern
      if (meaninglessPatterns.some((pattern) => pattern.test(cleaned)))
        return false

      // Check if it's a very short single character that's likely meaningless
      if (cleaned.length === 1 && /[\-\.\|\/\\\_~`'",:;]/.test(cleaned))
        return false

      return true
    }

    // Function to clean an entire row and check if it has meaningful content
    const cleanAndCheckRow = (
      row: string[]
    ): { cleanedRow: string[]; hasMeaning: boolean } => {
      const cleanedRow = row.map((cell) => cleanCell(cell))
      const meaningfulCells = cleanedRow.filter((cell) =>
        hasMeaningfulContent(cell)
      )

      return {
        cleanedRow,
        hasMeaning: meaningfulCells.length > 0,
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.match(/^\+[\-\+]+\+$/)) {
        if (!inTable) {
          if (currentText.trim()) {
            result.push({ isTable: false, content: currentText.trim() })
            currentText = ''
          }
          inTable = true
          tableRows = []
        }
        continue
      }

      if (inTable && line.includes('|')) {
        let cells = line.split('|').map((cell) => cell.trim())

        // Remove empty cells only from the beginning and end if they're truly empty
        // But keep all meaningful content including the first and last columns
        if (cells.length > 0 && cells[0] === '') {
          cells = cells.slice(1) // Remove empty first cell
        }
        if (cells.length > 0 && cells[cells.length - 1] === '') {
          cells = cells.slice(0, -1) // Remove empty last cell
        }

        if (cells.length > 0) {
          if (
            tableRows.length > 0 &&
            cells.some((cell, index) => cell === '' && index < cells.length - 1)
          ) {
            const lastRowIndex = tableRows.length - 1

            cells.forEach((cell, index) => {
              if (cell && index < tableRows[lastRowIndex].length) {
                tableRows[lastRowIndex][index] += ' ' + cell
              } else if (cell && index >= tableRows[lastRowIndex].length) {
                tableRows[lastRowIndex][index] = cell
              }
            })
          } else if (cells.some((cell) => cell !== '')) {
            tableRows.push(cells)
          }
        }
        continue
      }

      if (
        !inTable &&
        line.includes('|') &&
        !line.match(/^\|[\s\-\:]+\|/) &&
        line.split('|').filter((cell) => cell.trim()).length > 1
      ) {
        let cells = line.split('|').map((cell) => cell.trim())

        // Remove empty cells only from the beginning and end if they're truly empty
        if (cells.length > 0 && cells[0] === '') {
          cells = cells.slice(1)
        }
        if (cells.length > 0 && cells[cells.length - 1] === '') {
          cells = cells.slice(0, -1)
        }

        // Filter out completely empty cells but keep cells with any content
        cells = cells.filter((cell) => cell.length > 0)

        if (cells.length > 1) {
          if (currentText.trim()) {
            result.push({ isTable: false, content: currentText.trim() })
            currentText = ''
          }

          if (!inTable) {
            inTable = true
            tableRows = []
          }
          tableRows.push(cells)
          continue
        }
      } else if (line.match(/^\|[\s\-\:]+\|/)) {
        // Markdown table separator line - skip it
        continue
      } else if (inTable) {
        // End of table
        if (tableRows.length > 0) {
          // Clean up the table data and normalize column counts
          const maxCols = Math.max(...tableRows.map((row) => row.length))
          const cleanedRows = tableRows
            .map((row) => {
              const { cleanedRow, hasMeaning } = cleanAndCheckRow(row)
              return { row: cleanedRow, valid: hasMeaning }
            })
            .filter((item) => item.valid) // Remove rows with no meaningful content
            .map((item) => {
              // Normalize row length
              const normalizedRow = [...item.row]
              while (normalizedRow.length < maxCols) {
                normalizedRow.push('')
              }
              return normalizedRow
            })

          if (cleanedRows.length > 0) {
            result.push({ isTable: true, content: cleanedRows })
          }
        }
        inTable = false
        tableRows = []
        currentText += line + '\n'
      } else {
        currentText += line + '\n'
      }
    }

    // Handle remaining content
    if (inTable && tableRows.length > 0) {
      // Clean up the table data and normalize column counts
      const maxCols = Math.max(...tableRows.map((row) => row.length))
      const cleanedRows = tableRows
        .map((row) => {
          const { cleanedRow, hasMeaning } = cleanAndCheckRow(row)
          return { row: cleanedRow, valid: hasMeaning }
        })
        .filter((item) => item.valid) // Remove rows with no meaningful content
        .map((item) => {
          // Normalize row length
          const normalizedRow = [...item.row]
          while (normalizedRow.length < maxCols) {
            normalizedRow.push('')
          }
          return normalizedRow
        })

      if (cleanedRows.length > 0) {
        result.push({ isTable: true, content: cleanedRows })
      }
    } else if (currentText.trim()) {
      result.push({ isTable: false, content: currentText.trim() })
    }

    return result
  }

  const cleanContent = (content: string): string => {
    let cleanedContent = content

    // Remove markdown formatting but preserve content
    cleanedContent = cleanedContent
      // Extract content from code blocks (remove ``` but keep the content inside)
      .replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1')
      .replace(/```([\s\S]*?)```/g, '$1')
      .replace(/`([^`]+)`/g, '$1')

      // Remove markdown headers but preserve the text
      .replace(/^#{1,6}\s+/gm, '')

      // Clean HTML elements but preserve structure
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<b>|<\/b>/gi, '**')
      .replace(/<strong>|<\/strong>/gi, '**')
      .replace(/<i>|<\/i>/gi, '*')
      .replace(/<em>|<\/em>/gi, '*')
      .replace(/<u>|<\/u>/gi, '')
      .replace(/<h1[^>]*>|<\/h1>/gi, '\n# ')
      .replace(/<h2[^>]*>|<\/h2>/gi, '\n## ')
      .replace(/<h3[^>]*>|<\/h3>/gi, '\n### ')
      .replace(/<h4[^>]*>|<\/h4>/gi, '\n#### ')
      .replace(/<p[^>]*>|<\/p>/gi, '\n\n')
      .replace(/<div[^>]*>|<\/div>/gi, '\n')
      .replace(/<[^>]*>?/gm, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\\_+/g, (match) => '_'.repeat(match.length / 2))
      .replace(/_{3,}/g, (match) => '_'.repeat(Math.max(15, match.length)))

      // Generic chapter/article detection
      .replace(/ΚΕΦΑΛΑΙΟ\s+(\d+):/g, '\n\n# ΚΕΦΑΛΑΙΟ $1:\n')
      .replace(/ΑΡΘΡΟ\s+(\d+):/g, '\n\n## ΑΡΘΡΟ $1:\n')
      .replace(/CHAPTER\s+(\d+):/gi, '\n\n# CHAPTER $1:\n')
      .replace(/ARTICLE\s+(\d+):/gi, '\n\n## ARTICLE $1:\n')

      .replace(
        /ΙΔΙΩΤΙΚΟ\s+ΣΥΜΦΩΝΗΤΙΚΟ.*?ΠΩΛΗΣΗΣ/g,
        '\n\n# ΙΔΙΩΤΙΚΟ ΣΥΜΦΩΝΗΤΙΚΟ ΠΡΟΚΑΤΑΡΚΤΙΚΗΣ ΜΙΣΘΩΣΗΣ ΑΚΙΝΗΤΟΥ ΜΕ ΔΙΚΑΙΩΜΑ ΠΡΟΚΑΤΑΡΚΤΙΚΗΣ ΠΩΛΗΣΗΣ\n'
      )

      // Remove specific transitional phrases that slip through AI cleaning
      .replace(/Προχωρώ\s+στο\s+επόμενο\s+κεφάλαιο\.?/gi, '')
      .replace(/Προχωρώ\s+στο\s+επόμενο\.?/gi, '')
      .replace(/I\s+proceed\s+to\s+the\s+next\s+chapter\.?/gi, '')
      .replace(/Moving\s+to\s+the\s+next\s+chapter\.?/gi, '')
      .replace(/Πάμε\s+στο\s+επόμενο\.?/gi, '')
      .replace(/Συνεχίζω\s+με\.?/gi, '')

      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return cleanedContent
  }

  const createTableFromData = (tableData: string[][]): Table => {
    // Find the maximum number of columns
    const maxCols = Math.max(...tableData.map((row) => row.length))

    // Normalize all rows to have the same number of columns
    const normalizedData = tableData.map((row) => {
      const newRow = [...row]
      while (newRow.length < maxCols) {
        newRow.push('')
      }
      return newRow
    })

    const rows = normalizedData.map((rowData, rowIndex) => {
      const isHeader = rowIndex === 0

      const cells = rowData.map(
        (cellText) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cellText,
                    bold: isHeader,
                    color: isHeader ? 'FFFFFF' : '000000',
                    size: isHeader ? 24 : 22, // 11pt for header, 10pt for content
                  }),
                ],
                alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                spacing: {
                  before: 100,
                  after: 100,
                },
              }),
            ],
            shading: isHeader
              ? {
                  type: ShadingType.SOLID,
                  color: '808080',
                }
              : undefined,
            verticalAlign: VerticalAlign.CENTER,
            margins: {
              top: 150,
              bottom: 150,
              left: 150,
              right: 150,
            },
            width: {
              size: Math.floor(100 / maxCols),
              type: WidthType.PERCENTAGE,
            },
          })
      )

      return new TableRow({
        children: cells,
        height: {
          value: isHeader ? 600 : 400,
          rule: 'atLeast',
        },
      })
    })

    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideHorizontal: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: '000000',
        },
        insideVertical: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: '000000',
        },
      },
      margins: {
        top: 200,
        bottom: 200,
      },
    })
  }

  const convertMarkdownToDocElements = (
    content: string
  ): (Paragraph | Table)[] => {
    const parsedContent = parseMarkdownTable(content)
    const elements: (Paragraph | Table)[] = []

    parsedContent.forEach((item) => {
      if (item.isTable) {
        const tableData = item.content as string[][]
        elements.push(createTableFromData(tableData))
      } else {
        const textContent = item.content as string
        const lines = textContent.split('\n')

        lines.forEach((line) => {
          line = line.trim()
          if (!line) {
            elements.push(
              new Paragraph({
                children: [],
                spacing: { after: 50, before: 50 },
              })
            ) // Empty paragraph for spacing
            return
          }

          // Handle headers
          if (line.startsWith('# ')) {
            elements.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [
                  new TextRun({
                    text: line.substring(2),
                    bold: true,
                    size: 26, // 13pt
                    color: '000000',
                  }),
                ],
                spacing: { before: 150, after: 100 },
                // alignment: AlignmentType.CENTER,
              })
            )
          } else if (line.startsWith('## ')) {
            elements.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                  new TextRun({
                    text: line.substring(3),
                    bold: true,
                    size: 24, // 14pt
                    color: '000000',
                  }),
                ],
                spacing: { before: 100, after: 50 },
              })
            )
          } else if (line.startsWith('### ')) {
            elements.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: [
                  new TextRun({
                    text: line.substring(4),
                    bold: true,
                    size: 24, // 12pt
                    color: '000000',
                  }),
                ],
                spacing: { before: 100, after: 50 },
              })
            )
          } else {
            // Regular paragraph with markdown formatting
            const textRuns: TextRun[] = []
            let currentText = line

            // Handle bold text
            currentText = currentText.replace(
              /\*\*(.*?)\*\*/g,
              (match, text) => {
                textRuns.push(new TextRun({ text, bold: true }))
                return `__BOLD_${textRuns.length - 1}__`
              }
            )

            // Handle italic text
            currentText = currentText.replace(/\*(.*?)\*/g, (match, text) => {
              textRuns.push(new TextRun({ text, italics: true }))
              return `__ITALIC_${textRuns.length - 1}__`
            })

            // Split by placeholders and add regular text + formatted text
            const parts = currentText.split(/(__(?:BOLD|ITALIC)_\d+__)/)
            const finalRuns: TextRun[] = []

            parts.forEach((part) => {
              if (part.startsWith('__BOLD_')) {
                const index = parseInt(part.match(/__BOLD_(\d+)__/)![1])
                finalRuns.push(textRuns[index])
              } else if (part.startsWith('__ITALIC_')) {
                const index = parseInt(part.match(/__ITALIC_(\d+)__/)![1])
                finalRuns.push(textRuns[index])
              } else if (part) {
                finalRuns.push(new TextRun({ text: part, size: 22 })) // 11pt
              }
            })

            if (finalRuns.length === 0) {
              finalRuns.push(new TextRun({ text: line, size: 22 }))
            }

            elements.push(
              new Paragraph({
                children: finalRuns,
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 50, after: 50 },
              })
            )
          }
        })
      }
    })

    return elements
  }

  try {
    // Try AI-powered organization first
    toast.info('Εξαγωγή σε εξέλιξη...')
    let organizedContent = await organizeContentWithAI(messages)

    // Fallback to manual organization if AI fails
    if (!organizedContent) {
      // toast.info('Χρήση εναλλακτικής μεθόδου οργάνωσης...')
      organizedContent = organizeContentFallback(messages)
    }

    if (
      organizedContent.nonChapterResponses.length === 0 &&
      organizedContent.chapters.length === 0
    ) {
      // toast.error('Δεν βρέθηκαν απαντήσεις για εξαγωγή')
      return
    }

    // Create the document
    const children: (Paragraph | Table)[] = []

    // Add non-chapter responses first
    organizedContent.nonChapterResponses.forEach((response, index) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({
              text: `Απάντηση ${index + 1}:`,
              bold: true,
              color: '000000',
              size: 24,
            }),
          ],
          spacing: { before: 100, after: 75 },
        })
      )

      const answerElements = convertMarkdownToDocElements(
        cleanContent(response.content)
      )
      children.push(...answerElements)

      // Add separator
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          spacing: { after: 400 },
        })
      )
    })

    // Add chapters in order (they should already be sorted by AI or fallback)
    organizedContent.chapters.forEach((chapter) => {
      const answerElements = convertMarkdownToDocElements(
        cleanContent(chapter.content)
      )
      children.push(...answerElements)

      // Add separator
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          spacing: { after: 400 },
        })
      )
    })

    // Create and save the document
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              color: '000000',
              font: 'Arial',
              size: 22, // 11pt default
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134, // 2cm in twentieths of a point
                right: 1134,
                bottom: 1134,
                left: 1134,
              },
            },
          },
          children: children,
        },
      ],
    })

    const blob = await Packer.toBlob(doc)

    const timestamp = new Date()
      .toLocaleString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(/[/:\s]/g, '_')

    saveAs(blob, `Contract_Responses_${timestamp}.docx`)

    toast.success('Εξαγωγή ολοκληρώθηκε με επιτυχία')
  } catch (error) {
    console.error('Error exporting contract:', error)
    toast.error('Σφάλμα κατά την εξαγωγή')
  }
}
