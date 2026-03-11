'use server'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import db from '@/db/drizzle'
import {
  chat_files,
  chat_summaries,
  chats,
  messages,
  references,
  temp_references,
  user_lawbot_preferences,
} from '@/db/schema'
import { generateObject } from 'ai'
import { and, asc, desc, eq, inArray, lt, not, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { cookies } from 'next/headers'
import pg from 'pg'
import DocumentIntelligence, {
  getLongRunningPoller,
  AnalyzeResultOperationOutput,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence'
import { AzureKeyCredential } from '@azure/core-auth'
import { OpenAIEmbeddings } from '@langchain/openai'
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { PendingReference } from '@/lib/types/types'
import { DOMParser } from 'xmldom'

let cachedLLMModel: any = null
// Add/update these constants at the top
const MESSAGES_BEFORE_SUMMARY = 4 // Number of messages before creating a summary 
const MAX_SUMMARIES_TO_KEEP = 3 // Number of recent summaries to maintain
const MAX_CHARS_PER_FILE = 500 // Maximum characters to include from each file
const MAX_RECENT_MESSAGES = 6 // Keep last 3 exchanges (6 messages)

const getLocaleFromCookies = () => {
  const cookieStore = cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')
  return localeCookie ? localeCookie.value : 'el' // Default to Greek
}

async function createChatSummary(messages: any, locale: string) {
  if (!cachedLLMModel) {
    cachedLLMModel = await getLLMModel('claude-haiku-4-5-20251001')
  }

  const { object } = await generateObject({
    model: cachedLLMModel,
    schema: z.object({
      summary: z
        .string()
        .describe(
          'A concise summary of the key points and context from the conversation'
        ),
      keyTopics: z
        .array(z.string())
        .or(z.string()) // Allow either array or string
        .describe(
          'List of main topics as individual strings in an array, e.g. ["Property Valuation", "Expert Qualifications"]'
        ),
      legalContext: z
        .string()
        .describe('Any important legal context that should be preserved'),
    }),
    system: `You are a legal expert and summarizer. Create valid, insightful and concise extended summaries of legal discussions that:
      1. Capture the key legal questions and answers,
      2. Preserve important context needed for future questions,
      3. Identify the most recent and applicable law, the contradiction with past laws and main legal topics (as separate items in an array)
      4. Identify the most applicable past court cases that refer to the laws found,
      4. Use the appropriate language (${locale === 'el' ? 'Greek' : 'English'})
      5. Maintain clarity and precision in legal terminology

      IMPORTANT: The keyTopics must be returned as an array of strings, not a comma-separated string.
      Example format for keyTopics: ["Topic 1", "Topic 2", "Topic 3"]`,
    prompt: `Summarize this legal conversation segment. Include key points and context needed for future questions.
            Pay special attention to any legal references, principles, or case law mentioned.
            Remember to return keyTopics as an array of strings.
            
            Conversation:
            ${messages
              .map(
                (m: { role: any; content: any }) => `${m.role}: ${m.content}`
              )
              .join('\n\n')}`,
  })

  // Handle both array and string cases with proper type checking
  const keyTopics = Array.isArray(object.keyTopics)
    ? object.keyTopics
    : typeof object.keyTopics === 'string'
    ? object.keyTopics.split(',').map((topic) => topic.trim())
    : []

  return {
    summary: object.summary,
    keyTopics: keyTopics,
    legalContext: object.legalContext,
  }
}

export async function manageChatContext(
  chatId: string,
  currentMessages: (typeof messages.$inferSelect)[],
  locale: string
) {
  // Keep only the most recent messages for the immediate context
  const recentMessages = currentMessages.slice(-MAX_RECENT_MESSAGES)

  // Check if we need to create a new summary
  if (
    currentMessages.length >= MESSAGES_BEFORE_SUMMARY &&
    currentMessages.length % MESSAGES_BEFORE_SUMMARY === 0
  ) {
    // Get messages for this summary block
    const messagesToSummarize = currentMessages.slice(-MESSAGES_BEFORE_SUMMARY)
    const summary = await createChatSummary(messagesToSummarize, locale)

    // Store the summary
    await db.insert(chat_summaries).values({
      chatId,
      summary: summary.summary,
      keyTopics: summary.keyTopics,
      legalContext: summary.legalContext,
      messageRangeStart: currentMessages.length - MESSAGES_BEFORE_SUMMARY,
      messageRangeEnd: currentMessages.length - 1,
    })

    // Clean up old summaries if needed
    await cleanupOldSummaries(chatId)
  }

  // Build context for the next interaction
  const recentSummaries = await db
    .select()
    .from(chat_summaries)
    .where(eq(chat_summaries.chatId, chatId))
    .orderBy(desc(chat_summaries.createdAt))
    .limit(MAX_SUMMARIES_TO_KEEP)

  // Construct the context string
  let contextString = ''
  if (recentSummaries.length > 0) {
    contextString = `Previous Conversation Context:\n\n${recentSummaries
      .reverse()
      .slice(0, MAX_SUMMARIES_TO_KEEP)
      .map(
        (s, i) =>
          `Summary ${i + 1}:\n${s.summary}\n\nKey Legal Context:\n${
            s.legalContext
          }\n`
      )
      .join('\n')}`
  }

  return {
    contextString,
    recentMessages,
  }
}

async function cleanupOldSummaries(chatId: string) {
  const summariesCount = await db
    .select({ count: sql`count(*)` })
    .from(chat_summaries)
    .where(eq(chat_summaries.chatId, chatId))
    .then((res) => Number(res[0].count))

  if (summariesCount > MAX_SUMMARIES_TO_KEEP) {
    const summariesToKeep = await db
      .select()
      .from(chat_summaries)
      .where(eq(chat_summaries.chatId, chatId))
      .orderBy(desc(chat_summaries.createdAt))
      .limit(MAX_SUMMARIES_TO_KEEP)

    const keepIds = summariesToKeep.map((s) => s.id)

    await db
      .delete(chat_summaries)
      .where(
        and(
          eq(chat_summaries.chatId, chatId),
          not(inArray(chat_summaries.id, keepIds))
        )
      )
  }
}

export const getLawbotPreferences = async (userId: string) => {
  const prefs = await db
    .select()
    .from(user_lawbot_preferences)
    .where(eq(user_lawbot_preferences.userId, userId))
    .limit(1)

  if (prefs.length === 0) {
    const defaultPrefs = await db
      .insert(user_lawbot_preferences)
      .values({
        userId,
        includeGreekLaws: true,
        includeGreekCourtDecisions: true,
        includeEuropeanLaws: false,
        includeEuropeanCourtDecisions: false,
        includeGreekBibliography: false,
        includeForeignBibliography: false,
      })
      .returning()

    return defaultPrefs[0]
  }

  return prefs[0]
}

export const updateLawbotPreferences = async (
  userId: string,
  preferences: {
    includeGreekLaws?: boolean
    includeGreekCourtDecisions?: boolean
    includeEuropeanLaws?: boolean
    includeEuropeanCourtDecisions?: boolean
    includeGreekBibliography?: boolean
    includeForeignBibliography?: boolean
  }
) => {
  const locale = getLocaleFromCookies()
  await db
    .update(user_lawbot_preferences)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(user_lawbot_preferences.userId, userId))

  revalidatePath(`/${locale}/lawbot`)
}

export const getChats = async (userId: string) => {
  const data = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.createdAt))

  return data
}

export const updateChatNote = async (chatId: string, note: string) => {
  const locale = getLocaleFromCookies()
  await db.update(chats).set({ note }).where(eq(chats.id, chatId))

  revalidatePath(`/${locale}/lawbot/${chatId}`)
}

export const addChat = async ({
  title,
  userId,
}: {
  title?: string
  userId: string
}) => {
  const locale = getLocaleFromCookies()
  const ctitle = title ? title : generateChatTitle(locale)
  const data = await db
    .insert(chats)
    .values({
      title: ctitle,
      userId,
    })
    .returning({ chatId: chats.id })
  revalidatePath(`/${locale}/lawbot`)
  redirect(`/${locale}/lawbot/${data[0].chatId}`)
}

export const addMessage = async (
  chatId: string,
  role: string,
  content: string
) => {
  // Early return if content is too short or empty
  if (!content || content.trim().length < 3) {
    console.warn('Message content too short or empty - skipping save')
    return null
  }

  // Check for duplicate with previous message
  const previousMessage = await db.query.messages.findFirst({
    where: (messages, { eq, and }) =>
      and(
        eq(messages.chatId, chatId),
        eq(messages.content, content.trim()),
        eq(messages.role, role)
      ),
    orderBy: (messages, { desc }) => [desc(messages.createdAt)],
  })

  if (previousMessage) {
    console.warn('Duplicate message detected - skipping save')
    return previousMessage
  }

  const locale = getLocaleFromCookies()
  let retryCount = 0
  const maxRetries = 3
  const retryDelay = 100

  const saveMessageWithRetry = async () => {
    try {
      const savedMessage = await db.transaction(async (tx) => {
        const result = await tx
          .insert(messages)
          .values({
            chatId,
            content: content.trim(),
            role,
            createdAt: new Date(),
          })
          .returning()

        if (!result[0]) {
          throw new Error('Message save returned no result')
        }

        return result[0]
      })

      const allMessages = await getMessagesOfAchat(chatId)
      await manageChatContext(chatId, allMessages, locale)

      revalidatePath(`/${locale}/lawbot/${chatId}`)
      return savedMessage
    } catch (error: any) {
      console.error(
        `Failed to save message (attempt ${retryCount + 1}):`,
        error
      )

      if (retryCount < maxRetries) {
        retryCount++
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        return saveMessageWithRetry()
      }

      throw new Error(
        `Failed to save message after ${maxRetries} attempts: ${error.message}`
      )
    }
  }

  return saveMessageWithRetry()
}

// Helper function to ensure atomic message operations
export const ensureMessageOperation = async (operation: () => Promise<any>) => {
  let result
  try {
    result = await operation()
    if (!result) {
      throw new Error('Operation returned no result')
    }
    return result
  } catch (error) {
    console.error('Message operation failed:', error)
    throw error
  }
}

// New function to get chat summaries
export const getChatSummaries = async (chatId: string) => {
  return await db
    .select()
    .from(chat_summaries)
    .where(eq(chat_summaries.chatId, chatId))
    .orderBy(asc(chat_summaries.createdAt))
}

// Export the enhanced system message function
export async function enhanceSystemMessage(
  systemMessage: string,
  chatId: string,
  messages: any,
  locale: string
) {
  const { contextString, recentMessages } = await manageChatContext(
    chatId,
    messages,
    locale
  )

  // Truncate file content in system message if present
  const fileContentMatch = systemMessage.match(
    /The user has uploaded the following file\(s\)[\s\S]*?(?=\n\n|$)/
  )
  let truncatedSystemMessage = systemMessage

  if (fileContentMatch) {
    const fileContent = fileContentMatch[0]
    const truncatedFileContent = fileContent
      .split('\n\n')
      .map((file) => {
        const [filename, content] = file.split('\nContent: ')
        return `${filename}\nContent: ${content?.substring(
          0,
          MAX_CHARS_PER_FILE
        )}...`
      })
      .join('\n\n')

    truncatedSystemMessage = systemMessage.replace(
      fileContentMatch[0],
      truncatedFileContent
    )
  }

  if (contextString) {
    return `${truncatedSystemMessage}\n\n${contextString}`
  }
  return truncatedSystemMessage
}

export const getMessagesOfAchat = async (chatId: string) => {
  const data = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))

  return data
}

export const deleteChat = async (chatId: string) => {
  const locale = getLocaleFromCookies()
  await db.delete(chats).where(eq(chats.id, chatId))
  revalidatePath(`/${locale}/lawbot`)
  redirect(`/${locale}/lawbot`)
}

const generateChatTitle = (locale: string) => {
  return locale === 'el'
    ? `Νέα Συνομιλία ${Math.floor(Math.random() * 190).toFixed(0)}`
    : `New Chat ${Math.floor(Math.random() * 190).toFixed(0)}`
}

export const createMeaningfulchatTitle = async (
  chatId: string,
  context: string
) => {
  const locale = getLocaleFromCookies()

  // Cache the LLM model
  if (!cachedLLMModel) {
    cachedLLMModel = await getLLMModel('claude-haiku-4-5-20251001')
  }

  const { object: title } = await generateObject({
    model: cachedLLMModel,
    system: `
      You can generate meaningful conversation titles based on chat context.
      Titles must be compact and meaningful.
      Use the context provided to generate title.
      Titles must be no longer than 120 characters.
      The title should always be in ${locale === 'el' ? 'Greek' : 'English'}.
    `,
    prompt: `Generate a title based on this context: ${context}`,
    schema: z.object({
      title: z.string().describe('Title of the chat'),
    }),
  })

  await db
    .update(chats)
    .set({
      title: title.title,
    })
    .where(eq(chats.id, chatId))

  revalidatePath(`/${locale}/lawbot`)
  revalidatePath(`/${locale}/lawbot/${chatId}`)
}

export const getChatFiles = async (chatId: string) => {
  return await db
    .select()
    .from(chat_files)
    .where(eq(chat_files.chat_id, chatId))
    .orderBy(desc(chat_files.createdAt))
}

export const deleteChatFile = async (chatFileId: string, chatId: string) => {
  const locale = getLocaleFromCookies()
  await db.delete(chat_files).where(eq(chat_files.id, chatFileId))
  revalidatePath(`/${locale}/lawbot/${chatId}`)
}

//File upload code

export const saveChatFile = async ({
  chatId,
  base64Source,
  fileName,
  fileSize,
  fileType,
}: {
  chatId: string
  base64Source: string
  fileName: string
  fileType: string
  fileSize: number
}) => {
  const locale = getLocaleFromCookies()
  const formatted64 = base64Source.split(',')[1]
  const extractedText = await analyzeDocument(formatted64)
  if (extractedText) {
    const splittedDocuments = await splitDocuments(extractedText)
    const documents = splittedDocuments.map((doc) => ({
      pageContent: doc,
      metadata: { fileName, chatId },
    }))
    const vectorStore = await createPostgressVectorStore(chatId)
    await vectorStore.addDocuments(documents)
    await db.insert(chat_files).values({
      chat_id: chatId,
      file_name: fileName,
      file_content: extractedText,
      file_blob: formatted64,
      file_path: 'storage',
      file_size: fileSize.toString(),
      file_type: fileType,
    })
    revalidatePath(`/${locale}/lawbot/${chatId}`)
  }
}

const analyzeDocument = async (base64Source: string) => {
  const endpoint = process.env.DI_ENDPOINT
  const key = process.env.DI_KEY
  const client = DocumentIntelligence(endpoint!, new AzureKeyCredential(key!))
  const initialResponse = await client
    .path('/documentModels/{modelId}:analyze', 'prebuilt-read')
    .post({
      contentType: 'application/json',
      body: {
        base64Source,
      },
      queryParameters: { locale: 'en-IN' },
    })

  if (isUnexpected(initialResponse)) {
    throw initialResponse.body.error
  }
  const poller = await getLongRunningPoller(client, initialResponse)
  const result = (await poller.pollUntilDone())
    .body as AnalyzeResultOperationOutput

  return result.analyzeResult?.content
}

const splitDocuments = async (content: string) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 6000,
    chunkOverlap: 100,
  })
  return await splitter.splitText(content)
}

// Singleton pool for vector store — reused across all calls to avoid
// exhausting connections. Credentials come from environment variables.
let _vectorPool: InstanceType<typeof pg.Pool> | null = null
function getVectorPool() {
  if (!_vectorPool) {
    _vectorPool = new pg.Pool({
      host: process.env.VECTOR_DB_HOST || 'c-publisize-postgress.rcf5qaewuyzyua.postgres.cosmos.azure.com',
      port: Number(process.env.VECTOR_DB_PORT) || 5432,
      user: process.env.VECTOR_DB_USER || 'citus',
      password: process.env.VECTOR_DB_PASSWORD!,
      database: process.env.VECTOR_DB_NAME || 'citus',
      ssl: true,
      max: 5,
      idleTimeoutMillis: 30000,
    })
  }
  return _vectorPool
}

export const createPostgressVectorStore = async (chatId: string) => {
  const originalConfig = {
    pool: getVectorPool(),
    tableName: 'chat_files_embedding',
    collectionName: chatId,
    collectionTableName: 'chat_files_collection',
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'embedding',
      contentColumnName: 'document',
      metadataColumnName: 'metadata',
    },
  }
  const embeddings = new OpenAIEmbeddings()
  const pgvectorStore = new PGVectorStore(embeddings, originalConfig)
  return pgvectorStore
}

async function getNextRefSequence(chatId: string): Promise<number> {
  const existingRefs = await db
    .select({
      ref_sequence: references.ref_sequence,
    })
    .from(references)
    .where(eq(references.chatId, chatId))
    .orderBy(desc(references.ref_sequence))
    .limit(1)

  if (existingRefs.length === 0) {
    return 1 // Start from 1 if no existing references
  }

  // Extract the number from REF_X format and add 1
  const lastSequence = parseInt(
    existingRefs[0].ref_sequence?.replace('REF_', '') || '0'
  )
  return lastSequence + 1
}

export async function storePendingReferences(
  chatId: string,
  retrievedDocs: string[],
  referenceTypes: string[] // Add this parameter
) {
  try {
    const parser = new DOMParser()
    let successfulParses = 0
    let failedParses = 0

    let nextSequence = await getNextRefSequence(chatId)

    const parsedRefs = retrievedDocs
      .map((doc, index) => {
        try {
          const xmlDoc = parser.parseFromString(doc, 'text/xml')

          const getElementText = (element: string) => {
            const el = xmlDoc.getElementsByTagName(element)[0]
            return el?.textContent || ''
          }

          const metadata = xmlDoc.getElementsByTagName('metadata')[0]
          if (!metadata) {
            console.log(`No metadata found in document ${index + 1}`)
            return null
          }

          const summaryElement = metadata.getElementsByTagName('summary')[0]
          const summary = summaryElement?.textContent || ''
          const finalSummary =
            summary || getElementText('page_content').substring(0, 500) + '...'
          
          // Extract all source URL fields
          const documentUrl = getElementText('document_url') || ''
          const pdfUrl =
            getElementText('pdf_url') || getElementText('PDF_URL') || ''
          const pdfPageUrl = getElementText('pdf_page_url') || ''
          const fileUrl = getElementText('file_url') || ''
          const sourceUrl = getElementText('source_url') || ''

          const ref = {
            ref_sequence: `REF_${nextSequence++}`,
            pdf_url: documentUrl || pdfUrl,
            pdf_page_url: pdfPageUrl || '',
            file_url: fileUrl || '',
            source_url: sourceUrl || '',
            court: getElementText('court'),
            decision_number: getElementText('decision_number'),
            decision_date:
              getElementText('decision_date') || getElementText('date'), // Handle both field names
            case_type: getElementText('case_type'),
            main_laws:
              getElementText('main_laws') || getElementText('relevant_laws'), // Handle both field names
            key_articles:
              getElementText('key_articles') ||
              getElementText('related_law_provisions'),
            primary_issue:
              getElementText('primary_issue') ||
              getElementText('primary_legal_basis'),
            full_text: finalSummary,
            reference_type: referenceTypes[index] || 'unknown',
            generated_name:
              getElementText('File_Name') ||
              getElementText('file_name') ||
              null,
          }

          successfulParses++
          return ref
        } catch (parseError) {
          failedParses++
          console.error(`Error parsing document ${index + 1}:`, parseError)
          return null
        }
      })
      .filter((ref): ref is NonNullable<typeof ref> => ref !== null)

    const uniqueRefs = parsedRefs.filter(
      (ref, index, self) =>
        index ===
        self.findIndex(
          (r) =>
            (r.pdf_url && r.pdf_url === ref.pdf_url) ||
            (r.decision_number && r.decision_number === ref.decision_number)
        )
    )

    await db.insert(temp_references).values({
      chatId,
      refs: uniqueRefs,
      status: 'pending',
    })

    return uniqueRefs
  } catch (error: any) {
    console.error('Error in storePendingReferences:', error)
    throw error
  }
}

export async function savePendingReferences(chatId: string, messageId: string) {
  try {
    // Get the message content to check which references were actually used
    const message = await db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .limit(1)

    if (!message.length) {
      console.log('No message found')
      return
    }

    const content = message[0].content

    // Extract used references from the message
    let usedRefSequences: string[] = []

    // Pattern 1: REFERENCES_USED: [REF_1, REF_2, REF_3]
    const referencesMatch = content.match(/REFERENCES_USED:\s*\[(.*?)\]/i)
    if (referencesMatch) {
      usedRefSequences = referencesMatch[1]
        .split(',')
        .map((ref) => ref.trim())
        .filter((ref) => ref.startsWith('REF_'))
    }

    // Pattern 2: Extract all [REF_X] citations from the text
    if (!usedRefSequences.length) {
      const refMatches = [...content.matchAll(/\[REF_(\d+)\]/g)]
      usedRefSequences = [
        ...new Set(refMatches.map((match) => `REF_${match[1]}`)),
      ].sort()
    }

    // Pattern 3: Convert [1], [2] format to REF_1, REF_2
    if (!usedRefSequences.length) {
      const numericMatches = [...content.matchAll(/\[(\d+)\]/g)]
      usedRefSequences = [
        ...new Set(numericMatches.map((match) => `REF_${match[1]}`)),
      ].sort()
    }

    if (!usedRefSequences.length) {
      console.log('No references found in the message')
      return
    }

    // Get pending references
    const tempRefs = await db
      .select()
      .from(temp_references)
      .where(
        and(
          eq(temp_references.chatId, chatId),
          eq(temp_references.status, 'pending')
        )
      )
      .orderBy(desc(temp_references.createdAt))
      .limit(1)

    if (!tempRefs.length) {
      console.log('No pending references found')
      return
    }

    const allRefs: any = tempRefs[0].refs

    // Filter only the references that were actually used in the message
    const referencesToInsert = allRefs
      .filter((ref: any) => usedRefSequences.includes(ref.ref_sequence))
      .map((ref: any) => ({
        ...ref,
        chatId,
        messageId,
      }))

    if (referencesToInsert.length > 0) {
      await db.insert(references).values(referencesToInsert)
      await updateReferenceNames(chatId, messageId)
    }

    // Update status to complete
    await db
      .update(temp_references)
      .set({
        status: 'complete',
        messageId,
      })
      .where(eq(temp_references.id, tempRefs[0].id))

    return referencesToInsert
  } catch (error) {
    console.error('Error in savePendingReferences:', error)
    throw error
  }
}

// Add this helper function to clean up old completed references
async function cleanupOldTempReferences() {
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  await db
    .delete(temp_references)
    .where(
      and(
        eq(temp_references.status, 'complete'),
        lt(temp_references.createdAt, oneDayAgo)
      )
    )
}

export async function getReferencesForMessage(
  chatId: string,
  messageId: string
) {
  try {
    return await db
      .select()
      .from(references)
      .where(
        and(eq(references.chatId, chatId), eq(references.messageId, messageId))
      )
      .orderBy(asc(references.ref_sequence))
  } catch (error) {
    console.error('Error fetching message references:', error)
    throw error
  }
}

export async function getReferencesForChat(chatId: string) {
  try {
    return await db
      .select()
      .from(references)
      .where(eq(references.chatId, chatId))
      .orderBy(asc(references.ref_sequence))
  } catch (error) {
    console.error('Error fetching chat references:', error)
    throw error
  }
}

export const generateReferenceName = async (
  reference: {
    court?: string | null
    decision_number?: string | null
    decision_date?: string | null
    case_type?: string | null
    main_laws?: string | null
    full_text?: string | null
    primary_issue?: string | null
  },
  locale: string
) => {
  const selectedModel = await getLLMModel('claude-haiku-4-5-20251001')

  const { object } = await generateObject({
    model: selectedModel,
    schema: z.object({
      referenceName: z
        .string()
        .describe(
          'A meaningful, descriptive title for the legal reference that captures its key subject matter'
        ),
      referenceType: z
        .enum(['LAW', 'COURT_DECISION', 'LEGAL_ARTICLE', 'OTHER'])
        .describe('The type of legal reference'),
      shortCitation: z
        .string()
        .describe('A short citation format for this reference'),
    }),
    maxTokens: 1000,
    system: `
    You are a legal citation expert. Create meaningful titles and citations for legal references.
    
    Key Rules for Reference Names:
      1. The name you generate should always be in ${
        locale === 'el' ? 'Greek' : 'English'
      } (IMPORTANT)
      2. The name should clearly indicate the subject matter or key legal issue
      3. Always include relevant identifiers (law numbers, decision numbers, dates) when available
      4. Be specific and descriptive, avoiding generic terms
      5. Keep names concise but informative (max 100 characters)
      
      
      Title Formation Guidelines:
      - For Laws: "Law [Number]/[Year] on [Subject Matter]"
        Example: "Law 4548/2018 on Corporate Governance Reform"
      
      - For Court Decisions: "[Court] [Number]/[Year] - [Key Issue]"
        Example: "Supreme Court 1234/2023 - Contract Interpretation in Commercial Leases"
      
      - For Legal Articles: "Article [Number] of [Law] - [Subject Matter]"
        Example: "Article 281 Civil Code - Abuse of Rights"
      
      - For Other Types: Create a descriptive title based on the content
        Example: "Legal Opinion on Environmental Permits for Industrial Facilities"

      Use the full_text (summary) to extract meaningful subject matter information.
      Avoid generic titles or placeholder text.
      If information is missing, focus on what is available rather than using placeholders.
    `,
    prompt: `
      Generate a meaningful title and citation for this legal reference.
      Make sure to analyze the content/summary to identify the key subject matter.

      Court: ${reference.court || 'N/A'}
      Decision Number: ${reference.decision_number || 'N/A'}
      Decision Date: ${reference.decision_date || 'N/A'}
      Case Type: ${reference.case_type || 'N/A'}
      Main Laws: ${reference.main_laws || 'N/A'}
      Primary Issue: ${reference.primary_issue || 'N/A'}
      Content Summary: ${reference.full_text?.substring(0, 500) || 'N/A'}

      Create a title that captures the specific subject matter or legal issue being addressed.
      Do not use generic placeholders like "Decision" or "Unknown".
      Use the content summary to identify the key legal topic or issue.
    `,
  })

  return object
}

// Helper function to process a batch of references
export const processReferenceBatch = async (references: any[]) => {
  const processedRefs = await Promise.all(
    references.map(async (ref) => {
      const naming = await generateReferenceName(ref, getLocaleFromCookies())
      return {
        ...ref,
        generated_name: naming.referenceName,
        reference_type: naming.referenceType,
        short_citation: naming.shortCitation,
      }
    })
  )
  return processedRefs
}

// Function to store the generated names in the database
export const updateReferenceNames = async (
  chatId: string,
  messageId: string
) => {
  try {
    // Get all references for this message
    const refs = await getReferencesForMessage(chatId, messageId)

    // Process all references to get their names
    const processedRefs = await processReferenceBatch(refs)

    // Update each reference in the database
    for (const ref of processedRefs) {
      await db
        .update(references)
        .set({
          generated_name: ref.generated_name,
          reference_type: ref.reference_type,
          short_citation: ref.short_citation,
        })
        .where(
          and(
            eq(references.id, ref.id),
            eq(references.chatId, chatId),
            eq(references.messageId, messageId)
          )
        )
    }

    return processedRefs
  } catch (error) {
    console.error('Error updating reference names:', error)
    throw error
  }
}
