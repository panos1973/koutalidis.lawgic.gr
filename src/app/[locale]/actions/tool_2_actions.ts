'use server'
import db from '@/db/drizzle'
import {
  tool_2,
  tool_2_files,
  tool_2_messages,
  user_tool_2_preferences,
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

let cachedLLMModel: any = null

const getLocaleFromCookies = () => {
  const cookieStore = cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')
  return localeCookie ? localeCookie.value : 'el' // Default to Greek
}

export const getTool2Preferences = async (userId: string) => {
  const prefs = await db
    .select()
    .from(user_tool_2_preferences)
    .where(eq(user_tool_2_preferences.userId, userId))
    .limit(1)

  if (prefs.length === 0) {
    const defaultPrefs = await db
      .insert(user_tool_2_preferences)
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

export const updateTool2Preferences = async (
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
    .update(user_tool_2_preferences)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(user_tool_2_preferences.userId, userId))

  revalidatePath(`/${locale}/tool-2`)
}

export const getTool2ChatsHistory = async (userId: string) => {
  return await db
    .select()
    .from(tool_2)
    .where(eq(tool_2.userId, userId))
    .orderBy(desc(tool_2.createdAt))
}

export const updateTool2Note = async (tool2Id: string, note: string) => {
  const locale = getLocaleFromCookies()
  await db.update(tool_2).set({ note }).where(eq(tool_2.id, tool2Id))

  revalidatePath(`/${locale}/tool-2`)
  revalidatePath(`/${locale}/tool-2/${tool2Id}`)
}

export const createTool2Chat = async (userId: string) => {
  const locale = getLocaleFromCookies()
  const data = await db
    .insert(tool_2)
    .values({ userId, title: generateToolTitle(locale) })
    .returning({ tool2Id: tool_2.id })
  const tool2Id = data[0].tool2Id
  revalidatePath(`/${locale}/tool-2`)
  redirect(`/${locale}/tool-2/${tool2Id}`)
}

export const createMeaningfulTool2Title = async (
  toolId: string,
  context: string
) => {
  const locale = getLocaleFromCookies()

  if (!cachedLLMModel) {
    cachedLLMModel = await getLLMModel('claude-haiku-4-5-20251001')
  }

  const { object: title } = await generateObject({
    model: cachedLLMModel,
    system: `
      You can generate meaningful tool 2 titles 
      based on chat context.
      Titles must be compact and meaningful.
      Use the context provided to generate title.
      Titles must be no longer than 120 characters.
      The title should always be in ${locale === 'el' ? 'Greek' : 'English'}.
      `,
    prompt: `Generate a title based on this context: ${context}`,
    schema: z.object({
      title: z.string().describe('Title of the tool 2'),
    }),
  })

  await db
    .update(tool_2)
    .set({
      title: title.title,
    })
    .where(eq(tool_2.id, toolId))

  // Revalidate paths to update the frontend
  revalidatePath(`/${locale}/tool-2`)
  revalidatePath(`/${locale}/tool-2/${toolId}`)
}

const generateToolTitle = (locale: string) => {
  return locale === 'el'
    ? `Εργαλείο ${Math.floor(Math.random() * 10000).toFixed(0)}`
    : `Tool ${Math.floor(Math.random() * 10000).toFixed(0)}`
}

export const deleteTool2Chat = async (tool2Id: string) => {
  const locale = getLocaleFromCookies()
  await db.delete(tool_2).where(eq(tool_2.id, tool2Id))
  revalidatePath(`/${locale}/tool-2`)
  redirect(`/${locale}/tool-2`)
}

export const getTool2Chat = async (tool2Id: string) => {
  return await db.select().from(tool_2).where(eq(tool_2.id, tool2Id))
}

export const getTool2Files = async (tool2Id: string) => {
  return await db
    .select()
    .from(tool_2_files)
    .where(eq(tool_2_files.tool_2_id, tool2Id))
    .orderBy(desc(tool_2_files.createdAt))
}

export const deleteTool2File = async (tool2FileId: string, toolId: string) => {
  const locale = getLocaleFromCookies()
  await db.delete(tool_2_files).where(eq(tool_2_files.id, tool2FileId))
  revalidatePath(`/${locale}/tool-2/${toolId}`)
}

export const getTool2Messages = async (tool2Id: string) => {
  return await db
    .select()
    .from(tool_2_messages)
    .where(eq(tool_2_messages.tool_2_id, tool2Id))
    .orderBy(asc(tool_2_messages.createdAt))
}
export const saveToolMessage = async (
  tool2Id: string,
  role: string,
  message: string
) => {
  const locale = getLocaleFromCookies()
  const data = await db
    .insert(tool_2_messages)
    .values({
      content: message,
      tool_2_id: tool2Id,
      role,
    })
    .returning({ tool2MessageId: tool_2_messages.id })
  const tool2MessageId = data[0].tool2MessageId
  revalidatePath(`/${locale}/tool-2`)
  revalidatePath(`/${locale}/tool-2/${tool2Id}`)
  // return tool2MessageId;
}

//File upload code

export const saveToolFile = async ({
  tool2Id,
  base64Source,
  fileName,
  fileSize,
  fileType,
}: {
  tool2Id: string
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
    const documents = splittedDocuments.map(
      (doc) =>
        new Document({
          pageContent: doc,
          metadata: { fileName, tool2Id },
        })
    )
    const vectorStore = await createPostgressVectorStore(tool2Id)
    await vectorStore.addDocuments(documents)
    await db.insert(tool_2_files).values({
      tool_2_id: tool2Id,
      file_name: fileName,
      file_content: extractedText,
      file_blob: formatted64,
      file_path: 'storage',
      file_size: fileSize.toString(),
      file_type: fileType,
    })
    revalidatePath(`/${locale}/tool-2/${tool2Id}`)
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

  // console.log(result);
  // let content: string = "";

  // if (result.analyzeResult?.pages) {
  //   console.log(result.analyzeResult.pages.length);

  //   for (const page of result.analyzeResult.pages) {
  //     if (page && page.lines) {
  //       page.lines.forEach((line) => {
  //         content += line.content;
  //       });
  //     }
  //   }
  // }
  // console.log(content);

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

export const createPostgressVectorStore = async (tool2Id: string) => {
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
    tableName: 'tool_2_embedding',
    collectionName: tool2Id,
    collectionTableName: 'tool_2_collection',
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
