'use server'

import db from '@/db/drizzle'
import {
  library_files,
  library_folders,
  library_folder_sharing,
} from '@/db/schema'
import { and, count, desc, eq, inArray, or, sum } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { del } from '@vercel/blob'
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { createWorker } from 'tesseract.js'
import WordExtractor from 'word-extractor' // Add this import
import {
  addDocumentsToLibraryIndex,
  deleteLibraryDocuments,
  searchLibraryDocuments,
} from '@/lib/elasticsearch_/library'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

// Helper function to get locale from cookies
const getLocaleFromCookies = () => {
  const cookieStore = cookies()
  return cookieStore.get('NEXT_LOCALE')?.value || 'el'
}

export async function getUserFileStats(userId: string) {
  const result = await db
    .select({
      totalFiles: count(library_files.id).as('totalFiles'),
      totalSize: sum(library_files.fileSize).as('totalSize'),
    })
    .from(library_files)
    .innerJoin(library_folders, eq(library_files.folderId, library_folders.id))
    .where(eq(library_folders.userId, userId))

  return result[0] // Returns { totalFiles: number, totalSize: number }
}

export const createLibraryFolder = async (
  folderName: string,
  userId: string,
  organizationId?: string
) => {
  const locale = getLocaleFromCookies()
  await db
    .insert(library_folders)
    .values({
      folderName,
      userId,
      organizationId,
      isPrivate: true,
      isShared: false,
    })
    .returning()
  revalidatePath(`/${locale}/library`)
}

export const updateFolderName = async (
  folderId: string,
  folderName: string
) => {
  await db
    .update(library_folders)
    .set({
      folderName,
    })
    .where(eq(library_folders.id, folderId))
  revalidatePath(`/${getLocaleFromCookies()}/library/${folderId}`)
}

export const getLibraryFolders = async (
  userId: string,
  organizationId?: string
) => {
  // If organizationId is provided, get both user's folders and shared folders for the organization
  if (organizationId) {
    return db.query.library_folders.findMany({
      where: or(
        eq(library_folders.userId, userId),
        and(
          eq(library_folders.organizationId, organizationId),
          eq(library_folders.isShared, true)
        )
      ),
      with: {
        libraryFiles: true,
      },
      orderBy: desc(library_folders.createdAt),
    })
  }

  // Otherwise just get the user's folders
  return db.query.library_folders.findMany({
    where(fields) {
      return eq(fields.userId, userId)
    },
    with: {
      libraryFiles: true,
    },
    orderBy: desc(library_folders.createdAt),
  })
}

export const getLibraryFolderFiles = async (folderId: string) => {
  return await db.query.library_folders.findFirst({
    where(fields) {
      return eq(fields.id, folderId)
    },
    with: {
      libraryFiles: true,
    },
  })
}

export const getAllLibraryFolderFiles = async (userId: string) => {
  return await db.query.library_folders.findMany({
    where(fields) {
      return eq(fields.userId, userId)
    },
    with: {
      libraryFiles: true,
    },
  })
}

export const uploadLibraryFile = async (
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  folderId: string
) => {
  try {
    console.log(`Processing file: ${fileName} (${fileType})`)
    const res = await fetch(fileUrl)

    if (!res.ok) throw new Error('No file found on the URL')

    const fileBlob = await res.blob()

    let content = ''
    console.log(fileType)

    switch (fileType) {
      case 'application/pdf':
        content = await parsePdf(fileBlob)
        break
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        content = await parseDocx(fileBlob)
        break
      case 'application/msword':
        content = await parseDoc(fileBlob)
        break
      case 'text/csv':
        content = await parseCsv(fileBlob)
        break
      case 'text/plain':
        content = await parseTxt(fileBlob)
        break
      case 'image/png':
        content = await identifyImage(fileUrl)
        break
      case 'image/jpeg':
        content = await identifyImage(fileUrl)
        break
      case 'image/jpg':
        content = await identifyImage(fileUrl)
        break
      default:
        throw new Error('Unsupported file type')
    }

    const fileId: string = uuidv4()
    const cleaned = cleanContent(content)
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 6000,
      chunkOverlap: 100,
    })
    const splittedContents = await splitter.splitText(cleaned)
    const documents = splittedContents.map((content, index) => {
      const id = uuidv4()
      return new Document({
        id,
        pageContent: content,
        metadata: {
          folder_id: folderId,
          file_name: fileName,
          chunk_index: index,
          chunk_id: id,
          file_url: fileUrl,
          file_id: fileId,
        },
      })
    })

    const chunkIds = documents.map((d) => d.metadata.chunk_id)

    await addDocumentsToLibraryIndex(
      documents,
      documents.map((d) => d.metadata.chunk_id)
    )

    await db.insert(library_files).values({
      id: fileId,
      fileName: fileName,
      fileType: fileType,
      fileSize: fileSize.toString(),
      folderId: folderId,
      storageUrl: fileUrl,
      chunkIds: chunkIds,
    })

    revalidatePath(`/${getLocaleFromCookies()}/library/${folderId}`)
    return { success: true, fileId }
  } catch (error) {
    console.error('Error uploading file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
    }
  }
}

export const searchLibraryFiles = async (query: string, chunkIds: string[]) => {
  try {
    const filter = [
      {
        operator: 'match',
        field: 'chunk_id',
        value: chunkIds.toString(),
      },
    ]
    const similaritySearchResults = await searchLibraryDocuments(
      query,
      5,
      filter
    )
    let content = ''
    for (const doc of similaritySearchResults) {
      console.log(
        `* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`
      )
      content = `* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`
    }
    return content
  } catch (e) {
    console.error(e)
    return 'Error in searching library documents'
  }
}

export const shareLibraryFolder = async (
  folderId: string,
  organizationId: string
) => {
  const locale = getLocaleFromCookies()

  // Update the folder to mark it as shared
  await db
    .update(library_folders)
    .set({
      isShared: true,
      organizationId,
    })
    .where(eq(library_folders.id, folderId))

  // Add entry to sharing table
  await db
    .insert(library_folder_sharing)
    .values({
      folderId,
      organizationId,
    })
    .onConflictDoNothing()

  revalidatePath(`/${locale}/library`)
}

export const unshareLibraryFolder = async (folderId: string) => {
  const locale = getLocaleFromCookies()

  // Update the folder to mark it as not shared
  await db
    .update(library_folders)
    .set({
      isShared: false,
    })
    .where(eq(library_folders.id, folderId))

  // Remove entries from sharing table
  await db
    .delete(library_folder_sharing)
    .where(eq(library_folder_sharing.folderId, folderId))

  revalidatePath(`/${locale}/library`)
}

export const deleteFolders = async (ids: string[]) => {
  try {
    // First get all files in these folders to clean up Elasticsearch
    const fileChunks = await db
      .select()
      .from(library_files)
      .where(inArray(library_files.folderId, ids))

    // Delete from Elasticsearch
    if (fileChunks.length > 0) {
      const chunkIdsToDelete = fileChunks.flatMap((f) => f.chunkIds || [])
      if (chunkIdsToDelete.length > 0) {
        await deleteLibraryDocuments(chunkIdsToDelete)
      }
    }

    // Delete files from storage
    for (const file of fileChunks) {
      try {
        if (file.storageUrl) {
          await del(file.storageUrl)
        }
      } catch (error) {
        console.error('Error deleting file from storage:', error)
      }
    }

    // Delete folders from database (cascade will delete files)
    await db.delete(library_folders).where(inArray(library_folders.id, ids))
    revalidatePath(`/${getLocaleFromCookies()}/library`)
  } catch (e) {
    console.error(e)
  }
}

export const deleteFiles = async (ids: string[]) => {
  try {
    // Get files to delete
    const files = await db
      .select()
      .from(library_files)
      .where(inArray(library_files.id, ids))

    // Delete from Elasticsearch
    const chunkIdsToDelete = files.flatMap((f) => f.chunkIds || [])
    if (chunkIdsToDelete.length > 0) {
      await deleteLibraryDocuments(chunkIdsToDelete)
    }

    // Delete files from storage
    for (const file of files) {
      try {
        if (file.storageUrl) {
          await del(file.storageUrl)
        }
      } catch (error) {
        console.error('Error deleting file from storage:', error)
      }
    }

    // Delete files from database
    const result = await db
      .delete(library_files)
      .where(inArray(library_files.id, ids))

    // Get the folder ID from the first file to revalidate the path
    if (files.length > 0) {
      revalidatePath(`/${getLocaleFromCookies()}/library/${files[0].folderId}`)
    }

    return result
  } catch (e) {
    console.error(e)
    return null
  }
}

async function parsePdf(blob: Blob) {
  const loader = new PDFLoader(blob)
  const docs = await loader.load()
  return docs.map((doc) => doc.pageContent).join('\n')
}

async function parseDocx(blob: Blob) {
  const loader = new DocxLoader(blob)
  const docs = await loader.load()
  return docs.map((doc) => doc.pageContent).join('\n')
}

async function parseCsv(blob: Blob) {
  const loader = new CSVLoader(blob)
  const docs = await loader.load()
  return docs.map((doc) => doc.pageContent).join('\n')
}

async function parseTxt(blob: Blob) {
  const loader = new TextLoader(blob)
  const docs = await loader.load()
  return docs.map((doc) => doc.pageContent).join('\n')
}

// FIXED: Replace the problematic parseDoc function
async function parseDoc(blob: Blob): Promise<string> {
  try {
    console.log('Attempting to parse .doc file using word-extractor...')

    const extractor = new WordExtractor()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const extracted = await extractor.extract(buffer)
    const text = extracted.getBody()

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in .doc file')
    }

    console.log(
      `Successfully extracted ${text.length} characters from .doc file`
    )
    return text
  } catch (error) {
    console.log(
      'word-extractor failed, trying DocxLoader for potential misnamed .docx file...'
    )

    // Fallback: try DocxLoader in case it's a misnamed .docx file
    try {
      const loader = new DocxLoader(blob)
      const docs = await loader.load()
      const text = docs.map((doc) => doc.pageContent).join('\n')

      if (!text || text.trim().length === 0) {
        throw new Error('No text content found using DocxLoader fallback')
      }

      console.log(
        `Successfully extracted ${text.length} characters using DocxLoader fallback`
      )
      return text
    } catch (docxError) {
      console.error('Both word-extractor and DocxLoader failed:', {
        originalError: error instanceof Error ? error.message : String(error),
        fallbackError:
          docxError instanceof Error ? docxError.message : String(docxError),
      })

      throw new Error(
        `Failed to parse .doc file. Please convert to .docx format. ` +
          `Original error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
      )
    }
  }
}

const splitDocuments = async (content: string) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 6000,
    chunkOverlap: 100,
  })
  return splitter.splitText(content)
}

/**
 * Cleans and normalizes text content, ensuring Greek text is properly encoded.
 * @param content - The raw text content to clean.
 * @returns The cleaned and normalized text content.
 */
const cleanContent = (content: string): string => {
  try {
    return content
      .normalize('NFC') // Normalize to Unicode NFC (Normalization Form C).
      .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces.
      .replace(/\s\s+/g, ' ') // Remove extra spaces.
      .trim() // Remove leading and trailing spaces.
  } catch (error) {
    console.error('Error cleaning content:', error)
    return content // Return original content in case of error.
  }
}

const identifyImage = async (imageUrl: string) => {
  let content = ''
  const worker = await createWorker(['eng', 'ell'])
  const ret = await worker.recognize(imageUrl)
  content = ret.data.text
  await worker.terminate()
  return content
}

export const moveLibraryFiles = async (
  fileIds: string[],
  targetFolderId: string
) => {
  try {
    const locale = getLocaleFromCookies()

    // Update the files to move them to the target folder
    await db
      .update(library_files)
      .set({
        folderId: targetFolderId,
      })
      .where(inArray(library_files.id, fileIds))

    // Revalidate both the target folder and the library page
    revalidatePath(`/${locale}/library/${targetFolderId}`)
    revalidatePath(`/${locale}/library`)

    return { success: true }
  } catch (error) {
    console.error('Error moving files:', error)
    return { success: false, error: 'Failed to move files' }
  }
}

export const downloadLibraryFile = async (fileId: string) => {
  try {
    const file = await db
      .select()
      .from(library_files)
      .where(eq(library_files.id, fileId))
      .limit(1)

    if (!file.length) {
      return { success: false, error: 'File not found' }
    }

    const fileData = file[0]
    return {
      success: true,
      fileUrl: fileData.storageUrl,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
    }
  } catch (error) {
    console.error('Error downloading file:', error)
    return { success: false, error: 'Failed to download file' }
  }
}

/**
 * Extracts and parses content from a file URL based on its type
 * @param fileUrl - URL of the file to parse
 * @param fileType - MIME type of the file
 * @returns The parsed and cleaned content from the file
 */
export const extractContentFromUrl = async (
  fileUrl: string,
  fileType: string
): Promise<string> => {
  try {
    console.log(`Processing file from URL: ${fileUrl} (${fileType})`)

    const res = await fetch(fileUrl)

    if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`)

    const fileBlob = await res.blob()

    let content = ''

    switch (fileType) {
      case 'application/pdf':
        content = await parsePdf(fileBlob)
        break
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        content = await parseDocx(fileBlob)
        break
      case 'application/msword':
        content = await parseDoc(fileBlob)
        break
      case 'text/csv':
        content = await parseCsv(fileBlob)
        break
      case 'text/plain':
        content = await parseTxt(fileBlob)
        break
      case 'image/png':
      case 'image/jpeg':
      case 'image/jpg':
        content = await identifyImage(fileUrl)
        break
      default:
        throw new Error(`Unsupported file type: ${fileType}`)
    }

    console.log(
      `Successfully processed file: ${content.length} characters extracted`
    )
    return cleanContent(content)
  } catch (error) {
    console.error(`Error extracting content from ${fileUrl}:`, error)
    // Don't let file processing errors crash the entire API
    throw new Error(
      `Failed to process file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}
