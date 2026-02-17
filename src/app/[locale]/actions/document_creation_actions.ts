'use server'
import db from '@/db/drizzle'
import {
  document_creation,
  document_creation_files,
  document_creation_messages,
  user_document_creation_preferences,
} from '@/db/schema'
import { asc, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import DocumentIntelligence from '@azure-rest/ai-document-intelligence'
import { AzureKeyCredential } from '@azure/core-auth'
import { put } from '@vercel/blob'
import pg from 'pg'
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import {
  getLongRunningPoller,
  AnalyzeResultOperationOutput,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence'
import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { cookies } from 'next/headers'
import {
  addDocumentsToElasticsearch,
  searchSimilarDocuments,
} from '@/lib/elasticsearch_/embedding'

let cachedLLMModel: any = null

const getLocaleFromCookies = () => {
  const cookieStore = cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')
  return localeCookie ? localeCookie.value : 'el' // Default to Greek
}

export const getDocumentCreationPreferences = async (userId: string) => {
  const prefs = await db
    .select()
    .from(user_document_creation_preferences)
    .where(eq(user_document_creation_preferences.userId, userId))
    .limit(1)

  if (prefs.length === 0) {
    const defaultPrefs = await db
      .insert(user_document_creation_preferences)
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

export const updateDocumentCreationPreferences = async (
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
    .update(user_document_creation_preferences)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(user_document_creation_preferences.userId, userId))

  revalidatePath(`/${locale}/document-creation`)
}

export const getDocumentCreations = async (userId: string) => {
  return await db
    .select()
    .from(document_creation)
    .where(eq(document_creation.userId, userId))
    .orderBy(desc(document_creation.createdAt))
}

export const updateDocumentCreationNote = async (
  documentCreationId: string,
  note: string
) => {
  const locale = getLocaleFromCookies()
  await db
    .update(document_creation)
    .set({ note })
    .where(eq(document_creation.id, documentCreationId))

  revalidatePath(`/${locale}/document-creation`)
  revalidatePath(`/${locale}/document-creation/${documentCreationId}`)
}

export const createDocumentCreation = async (userId: string) => {
  const locale = getLocaleFromCookies()
  const data = await db
    .insert(document_creation)
    .values({ userId, title: generateDocumentCreationTitle(locale) })
    .returning({ documentCreationId: document_creation.id })
  const documentCreationId = data[0].documentCreationId
  revalidatePath(`/${locale}/document-creation`)
  redirect(`/${locale}/document-creation/${documentCreationId}`)
}

export const createMeaningfulDocumentCreationTitle = async (
  documentCreationId: string,
  context: string
) => {
  const locale = getLocaleFromCookies()

  if (!cachedLLMModel) {
    cachedLLMModel = await getLLMModel('claude-haiku-4-5-20251001')
  }

  const { object: title } = await generateObject({
    model: cachedLLMModel,
    system: `
      You can generate meaningful document creation titles 
      based on chat context.
      Titles must be compact and meaningful.
      Use the context provided to generate title.
      Titles must be no longer than 120 characters.
      The title should always be in ${locale === 'el' ? 'Greek' : 'English'}.
      `,
    prompt: `Generate a title based on this context: ${context}`,
    schema: z.object({
      title: z.string().describe('Title of the document creation'),
    }),
  })

  await db
    .update(document_creation)
    .set({
      title: title.title,
    })
    .where(eq(document_creation.id, documentCreationId))

  // Revalidate paths to update the frontend
  revalidatePath(`/${locale}/document-creation`)
  revalidatePath(`/${locale}/document-creation/${documentCreationId}`)
}

const generateDocumentCreationTitle = (locale: string) => {
  return locale === 'el'
    ? `Δημιουργία Εγγράφου ${Math.floor(Math.random() * 10000).toFixed(0)}`
    : `Document Creation ${Math.floor(Math.random() * 10000).toFixed(0)}`
}

export const deleteDocumentCreation = async (documentCreationId: string) => {
  const locale = getLocaleFromCookies()
  await db
    .delete(document_creation)
    .where(eq(document_creation.id, documentCreationId))
  revalidatePath(`/${locale}/document-creation`)
  redirect(`/${locale}/document-creation`)
}

export const getDocumentCreation = async (documentCreationId: string) => {
  return await db
    .select()
    .from(document_creation)
    .where(eq(document_creation.id, documentCreationId))
}

export const getDocumentCreationFiles = async (documentCreationId: string) => {
  return await db
    .select()
    .from(document_creation_files)
    .where(eq(document_creation_files.document_creation_id, documentCreationId))
    .orderBy(desc(document_creation_files.createdAt))
}

export const deleteDocumentCreationFile = async (
  documentCreationFileId: string,
  documentCreationId: string
) => {
  const locale = getLocaleFromCookies()
  await db
    .delete(document_creation_files)
    .where(eq(document_creation_files.id, documentCreationFileId))
  revalidatePath(`/${locale}/document-creation/${documentCreationId}`)
}

export const getDocumentCreationMessages = async (
  documentCreationId: string
) => {
  return await db
    .select()
    .from(document_creation_messages)
    .where(
      eq(document_creation_messages.document_creation_id, documentCreationId)
    )
    .orderBy(asc(document_creation_messages.createdAt))
}

export const saveDocumentCreationMessage = async (
  documentCreationId: string,
  role: string,
  message: string
) => {
  // Early return if content is too short or empty
  if (!message || message.trim().length < 3) {
    console.warn('Message content too short or empty - skipping save')
    return null
  }

  // Check for duplicate with previous message
  const previousMessage = await db.query.document_creation_messages.findFirst({
    where: (document_creation_messages, { eq, and }) =>
      and(
        eq(document_creation_messages.document_creation_id, documentCreationId),
        eq(document_creation_messages.content, message.trim()),
        eq(document_creation_messages.role, role)
      ),
    orderBy: (document_creation_messages, { desc }) => [
      desc(document_creation_messages.createdAt),
    ],
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
          .insert(document_creation_messages)
          .values({
            content: message.trim(),
            document_creation_id: documentCreationId,
            role,
            createdAt: new Date(),
          })
          .returning()

        if (!result[0]) {
          throw new Error('Message save returned no result')
        }

        return result[0]
      })

      revalidatePath(`/${locale}/document-creation`)
      revalidatePath(`/${locale}/document-creation/${documentCreationId}`)
      return savedMessage
    } catch (error: any) {
      console.error(
        `Failed to save document creation message (attempt ${retryCount + 1}):`,
        error
      )

      if (retryCount < maxRetries) {
        retryCount++
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        return saveMessageWithRetry()
      }

      throw new Error(
        `Failed to save document creation message after ${maxRetries} attempts: ${error.message}`
      )
    }
  }

  return saveMessageWithRetry()
}

//File upload code
export const saveDocumentCreationFile = async ({
  documentCreationId,
  base64Source,
  fileName,
  fileSize,
  fileType,
  userId,
}: {
  documentCreationId: string
  base64Source: string
  fileName: string
  fileType: string
  fileSize: number
  userId: string
}) => {
  const locale = getLocaleFromCookies()
  const formatted64 = base64Source.split(',')[1]
  const extractedText = await analyzeDocument(formatted64)

  if (extractedText) {
    const splittedDocuments = await splitDocuments(extractedText)
    const documents = splittedDocuments.map((doc) => ({
      pageContent: doc,
      metadata: {
        fileName,
        documentCreationId,
        fileType,
        fileSize: fileSize.toString(),
      },
    }))

    // Add documents to Elasticsearch instead of PostgreSQL
    await addDocumentsToElasticsearch(userId, documents)

    // Still store the file info in your database
    await db.insert(document_creation_files).values({
      document_creation_id: documentCreationId,
      file_name: fileName,
      file_content: extractedText,
      file_blob: formatted64,
      file_path: 'storage',
      file_size: fileSize.toString(),
      file_type: fileType,
    })

    revalidatePath(`/${locale}/document-creation/${documentCreationId}`)
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
  const splitDocuments = await splitter.splitText(content)
  return splitDocuments
}

export const getAggregatedResultsByFilename = async (
  query: string,
  vectorStore: any
) => {
  const results = await vectorStore.similaritySearch(query, 5)

  const aggregatedResults = results.reduce((acc: any, result: any) => {
    const filename = result.metadata?.fileName || 'Unknown file'
    acc[filename] = (acc[filename] || '') + result.pageContent + ' '
    return acc
  }, {} as { [key: string]: string })

  Object.entries(aggregatedResults).forEach(
    ([filename, content]: any, index) => {
      console.log(`Aggregated Content for File ${index + 1}:`, {
        filename,
        content_preview: content.slice(0, 100) + '...',
        content,
      })
    }
  )

  return aggregatedResults
}

export const createPostgressVectorStore = async (
  documentCreationId: string
) => {
  const reusablePool = new pg.Pool({
    host: 'c-publisize-postgress.rcf5qaewuyzyua.postgres.cosmos.azure.com',
    port: 5432,
    user: 'citus',
    password: 'Db_pass123',
    database: 'citus',
    ssl: true,
  })
  const originalConfig = {
    pool: reusablePool,
    tableName: 'document_creation_files_embedding',
    collectionName: documentCreationId,
    collectionTableName: 'document_creation_files_collection',
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

export const searchDocumentCreationDocuments = async (
  userId: string,
  documentCreationId: string,
  query: string,
  k: number = 5
) => {
  const results = await searchSimilarDocuments(userId, query, k)

  // Filter for documents related to this document creation
  return results.filter(
    (doc) => doc.metadata.documentCreationId === documentCreationId
  )
}
