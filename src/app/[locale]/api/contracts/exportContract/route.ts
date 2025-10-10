// app/[locale]/api/contracts/exportContract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Extract assistant messages
    const assistantMessages = messages.filter(
      (msg: any) => msg.role === 'assistant' && msg.content.trim()
    )

    if (assistantMessages.length === 0) {
      return NextResponse.json(
        { error: 'No assistant messages found' },
        { status: 400 }
      )
    }

    // Clean message endings first
    const cleanedMessages = await cleanMessageEndings(assistantMessages)

    // Now create previews for organization
    const messagePreviews = cleanedMessages.map((msg: any, index: number) => ({
      index,
      // Only send first 1000 chars for analysis
      preview:
        msg.content.substring(0, 1000) +
        (msg.content.length > 1000 ? '...' : ''),
      fullLength: msg.content.length,
    }))

    const organizationPrompt = `You are a document organizer. I will give you PREVIEWS of AI assistant responses about a contract. Your job is to categorize and organize them WITHOUT returning the full content.

Rules:
1. Identify chapters/sections in MULTIPLE FORMATS:
   - Greek: ΚΕΦΑΛΑΙΟ/CHAPTER followed by numbers
   - English: Numbered sections like "1. PARTIES", "2. TERM", "3. PROBATIONARY"
   - Any pattern like "Section X", "Article X", or numbered headings
2. For chapters/sections: detect duplicates or revisions, prefer later messages (higher index)
3. For non-chapter content: detect similar responses, prefer more recent ones
4. AGGRESSIVE DUPLICATE DETECTION: If content is substantially similar (>70% overlap), consider it a duplicate
5. Return ONLY organization instructions, NOT the full content

Here are the message previews:
${messagePreviews
  .map(
    (msg: any) =>
      `--- Message ${msg.index} (${msg.fullLength} chars) ---\n${msg.preview}`
  )
  .join('\n\n')}

Return ONLY this JSON structure:
{
  "nonChapterResponses": [
    {
      "originalIndex": number,
      "reason": "brief reason for inclusion"
    }
  ],
  "chapters": [
    {
      "chapterNumber": number,
      "originalIndex": number,
      "reason": "brief reason for selection"
    }
  ],
  "duplicatesRemoved": [
    {
      "removedIndex": number,
      "reason": "why this was removed/replaced"
    }
  ]
}

Important: 
- Return ONLY indices and metadata, NOT content
- Be EXTREMELY aggressive with duplicate removal
- For English contracts: treat numbered sections (1., 2., 3.) as chapters
- If multiple messages contain the same employment contract sections, keep only the LATEST one
- Look for content similarity, not just identical chapter numbers
- If unsure about chapters vs duplicates, prefer removing duplicates`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: organizationPrompt,
        },
      ],
    })

    const aiResponse = response.content[0]
    if (aiResponse.type !== 'text') {
      throw new Error('Unexpected response type from AI')
    }

    // Parse the AI response
    let organizationPlan
    try {
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }
      organizationPlan = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse.text)
      throw new Error('Failed to parse AI response as JSON')
    }

    // Validate the structure
    if (!organizationPlan.nonChapterResponses || !organizationPlan.chapters) {
      throw new Error('Invalid response structure from AI')
    }

    // Now apply the organization plan locally with cleaned content
    const organizedContent = {
      nonChapterResponses: organizationPlan.nonChapterResponses.map(
        (item: any) => ({
          originalIndex: item.originalIndex,
          content: cleanedMessages[item.originalIndex]?.content || '',
        })
      ),
      chapters: organizationPlan.chapters.map((item: any) => ({
        chapterNumber: item.chapterNumber,
        originalIndex: item.originalIndex,
        content: cleanedMessages[item.originalIndex]?.content || '',
      })),
    }

    return NextResponse.json(organizedContent)
  } catch (error) {
    console.error('Error in organize-contract API:', error)
    return NextResponse.json(
      {
        error: 'Failed to organize contract content',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// New function to clean message endings
async function cleanMessageEndings(messages: any[]): Promise<any[]> {
  try {
    // Extract endings from all messages for batch processing
    const messageEndings = messages.map((msg, index) => {
      const lines = msg.content.trim().split('\n')
      const lastLines = lines.slice(-8).join('\n') // Increased from 5 to 8 lines
      return {
        index,
        ending: lastLines,
        fullContent: msg.content,
      }
    })

    // Batch process endings
    const endingsText = messageEndings
      .map(
        (item) =>
          `--- MESSAGE ${item.index} ENDING ---\n${item.ending}\n--- END MESSAGE ${item.index} ---`
      )
      .join('\n\n')

    const cleaningPrompt = `You must aggressively remove ALL conversational and transitional text from these message endings.

CRITICAL: Remove these EXACT phrases completely:
- "Προχωρώ στο επόμενο κεφάλαιο"
- "Προχωρώ στο επόμενο κεφάλαιο."
- "Προχωρώ στο επόμενο"
- "I proceed to the next chapter"
- "Moving to the next chapter"
- "does this look good"
- "φαίνεται καλό"
- "should i move to next chapter"
- "να προχωρήσω στο επόμενο κεφάλαιο"
- "let me know if you need changes"
- "ενημέρωσέ με αν χρειάζεται αλλαγές"
- "anything else to add"
- "κάτι άλλο να προσθέσω"
- "Πάμε στο επόμενο"
- "Συνεχίζω με"
- "Next, I will"
- "Στη συνέχεια"

ALSO REMOVE:
- Any sentence that talks about what the AI is doing next
- Any question asking for user feedback or approval
- Any transitional statement between document sections
- Any meta-commentary about the document process
- Lines that start with verbs describing AI actions (e.g., "Προχωρώ", "Συνεχίζω", "Πάμε")

ABSOLUTE RULES:
- BE EXTREMELY AGGRESSIVE - when in doubt, remove the line
- Return ONLY the cleaned endings with zero conversational content
- Preserve contract content ONLY (legal terms, clauses, definitions)
- If a line contains both contract content AND conversational elements, keep only the contract part
- If an entire ending is conversational, return completely empty content between the markers
- NO explanations, confirmations, or additional text from you whatsoever

${endingsText}`

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: cleaningPrompt,
        },
      ],
    })

    const cleanedResponse = response.content[0]
    if (cleanedResponse.type !== 'text') {
      throw new Error('Unexpected response type from cleaning AI')
    }

    // Parse the cleaned endings
    const cleanedEndingsText = cleanedResponse.text
    const cleanedEndingMatches = cleanedEndingsText.match(
      /--- MESSAGE (\d+) ENDING ---\n([\s\S]*?)\n--- END MESSAGE \1 ---/g
    )

    if (!cleanedEndingMatches) {
      // If cleaning fails, return original messages
      console.warn('Failed to parse cleaned endings, using original messages')
      return messages
    }

    // Create a map of cleaned endings
    const cleanedEndingsMap = new Map<number, string>()

    cleanedEndingMatches.forEach((match) => {
      const indexMatch = match.match(/--- MESSAGE (\d+) ENDING ---/)
      const contentMatch = match.match(
        /--- MESSAGE \d+ ENDING ---\n([\s\S]*?)\n--- END MESSAGE \d+ ---/
      )

      if (indexMatch && contentMatch) {
        const messageIndex = parseInt(indexMatch[1])
        const cleanedEnding = contentMatch[1].trim()
        cleanedEndingsMap.set(messageIndex, cleanedEnding)
      }
    })

    // Apply cleaned endings to messages
    const cleanedMessages = messages.map((msg, index) => {
      const originalLines = msg.content.trim().split('\n')
      const cleanedEnding = cleanedEndingsMap.get(index)

      if (cleanedEnding !== undefined) {
        // Replace last 8 lines with cleaned ending
        const mainContent = originalLines.slice(0, -8).join('\n')
        const newContent = cleanedEnding
          ? `${mainContent}\n${cleanedEnding}`.trim()
          : mainContent.trim()

        return {
          ...msg,
          content: newContent,
        }
      }

      return msg // Return original if cleaning failed for this message
    })

    return cleanedMessages
  } catch (error) {
    console.error('Error cleaning message endings:', error)
    // Return original messages if cleaning fails
    return messages
  }
}
