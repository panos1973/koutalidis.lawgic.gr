'use server'

import db from '@/db/drizzle'
import { vault_files, vault_folders, vault_folder_sharing } from '@/db/schema'
import { and, count, desc, eq, inArray, or, sum } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { VoyageEmbeddings } from '@langchain/community/embeddings/voyage'
import { v4 as uuidv4 } from 'uuid'
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import {
  ElasticVectorSearch,
  type ElasticClientArgs,
} from '@langchain/community/vectorstores/elasticsearch'
import { Client } from '@elastic/elasticsearch'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { createWorker } from 'tesseract.js'
import { del } from '@vercel/blob'
import { VaultFile } from '@/lib/types/types'
import { auth } from '@clerk/nextjs/server'

export async function getUserFileStats(userId: string) {
  const result = await db
    .select({
      totalFiles: count(vault_files.id).as('totalFiles'),
      totalSize: sum(vault_files.fileSize).as('totalSize'),
    })
    .from(vault_files)
    .innerJoin(vault_folders, eq(vault_files.folderId, vault_folders.id))
    .where(eq(vault_folders.userId, userId))

  return result[0] // Returns { totalFiles: number, totalSize: number }
}

export const creatVaultFolder = async (
  folderName: string,
  userId: string,
  organizationId?: string
) => {
  const locale = getLocaleFromCookies()
  await db
    .insert(vault_folders)
    .values({
      folderName,
      userId,
      organizationId,
      isPrivate: true,
      isShared: false,
    })
    .returning()
  revalidatePath(`/${locale}/vault`)
}

export const updateFolderName = async (
  folderId: string,
  folderName: string
) => {
  await db
    .update(vault_folders)
    .set({
      folderName,
    })
    .where(eq(vault_folders.id, folderId))
  revalidatePath(`/${getLocaleFromCookies()}/vault/${folderId}`)
}

export const getVaultFolders = async (
  userId: string,
  organizationId?: string
) => {
  // If organizationId is provided, get both user's folders and shared folders for the organization
  if (organizationId) {
    return db.query.vault_folders.findMany({
      where(fields) {
        return or(
          eq(fields.userId, userId),
          and(
            eq(fields.organizationId, organizationId),
            eq(fields.isShared, true)
          )
        )
      },
      with: {
        vaultFiles: true,
      },
      orderBy(fields) {
        return desc(fields.createdAt)
      },
    })
  }

  // Otherwise just get the user's folders
  return db.query.vault_folders.findMany({
    where(fields) {
      return eq(fields.userId, userId)
    },
    with: {
      vaultFiles: true,
    },
    orderBy(fields) {
      return desc(fields.createdAt)
    },
  })
}

export const getVaultFolderFiles = async (folderId: string) => {
  return await db.query.vault_folders.findFirst({
    where(fields) {
      return eq(fields.id, folderId)
    },
    with: {
      vaultFiles: true,
    },
  })
}

export const getAllFaultFolderFiles = async (userId: string) => {
  return await db.query.vault_folders.findMany({
    where(fields) {
      return eq(fields.userId, userId)
    },
    with: {
      vaultFiles: true,
    },
  })
}

export const uploadVaultFile = async (
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  folderId: string
) => {
  try {
    const [uploadedFile] = await db
      .insert(vault_files)
      .values({
        fileName: fileName,
        fileType: fileType,
        fileSize: fileSize.toString(),
        folderId: folderId,
        storageUrl: fileUrl,
      })
      .returning()

    revalidatePath(`/${getLocaleFromCookies()}/vault/${folderId}`)
    return uploadedFile
  } catch (e) {
    console.error(e)
  }
}

export const uploadContractFile = async (
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  folderId: string | null,
  contractId: string
): Promise<VaultFile> => {
  let contractFolderId = folderId
  
  if (!folderId) {
    const { userId, sessionClaims } = auth()
    //@ts-ignore
    const organizationId = sessionClaims?.o?.id!
    
    // First, check if a (D) Contracts folder already exists
    const existingFolder = await db.query.vault_folders.findFirst({
      where: and(
        eq(vault_folders.userId, userId!),
        eq(vault_folders.folderName, '(D) Contracts'),
        eq(vault_folders.organizationId, organizationId)
      )
    })
    
    if (existingFolder) {
      // Use the existing folder
      contractFolderId = existingFolder.id
    } else {
      // Create a new folder only if it doesn't exist
      const [folder] = await db
        .insert(vault_folders)
        .values({
          folderName: '(D) Contracts',
          userId: userId!,
          isPrivate: true,
          isShared: false,
          organizationId,
        })
        .returning()
      contractFolderId = folder.id
    }
  }

  const file = await uploadVaultFile(
    fileUrl,
    fileName,
    fileType,
    fileSize,
    contractFolderId!
  )
  
  revalidatePath(`/${getLocaleFromCookies()}/contract/${contractId}`)
  return file as VaultFile
}

export const uploadCaseFile = async (
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  folderId: string | null,
  caseId: string
): Promise<VaultFile> => {
  let caseFolderId = folderId
  
  if (!folderId) {
    const { userId, sessionClaims } = auth()
    //@ts-ignore
    const organizationId = sessionClaims?.o?.id!
    
    // First, check if a (D) Case Files folder already exists
    const existingFolder = await db.query.vault_folders.findFirst({
      where: and(
        eq(vault_folders.userId, userId!),
        eq(vault_folders.folderName, '(D) Case Files'),
        eq(vault_folders.organizationId, organizationId)
      )
    })
    
    if (existingFolder) {
      // Use the existing folder
      caseFolderId = existingFolder.id
    } else {
      // Create a new folder only if it doesn't exist
      const [folder] = await db
        .insert(vault_folders)
        .values({
          folderName: '(D) Case Files',
          userId: userId!,
          isPrivate: true,
          isShared: false,
          organizationId,
        })
        .returning()
      caseFolderId = folder.id
    }
  }

  const file = await uploadVaultFile(
    fileUrl,
    fileName,
    fileType,
    fileSize,
    caseFolderId!
  )
  
  revalidatePath(`/${getLocaleFromCookies()}/case-research/${caseId}`)
  return file as VaultFile
}

export const uploadAthenaFile = async (
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  folderId: string | null,
  chatId: string
): Promise<VaultFile> => {
  let athenaFolderId = folderId
  
  if (!folderId) {
    const { userId, sessionClaims } = auth()
    //@ts-ignore
    const organizationId = sessionClaims?.o?.id!
    
    // First, check if a (D) Athena Files folder already exists
    const existingFolder = await db.query.vault_folders.findFirst({
      where: and(
        eq(vault_folders.userId, userId!),
        eq(vault_folders.folderName, '(D) Athena Files'),
        eq(vault_folders.organizationId, organizationId)
      )
    })
    
    if (existingFolder) {
      // Use the existing folder
      athenaFolderId = existingFolder.id
    } else {
      // Create a new folder only if it doesn't exist
      const [folder] = await db
        .insert(vault_folders)
        .values({
          folderName: '(D) Athena Files',
          userId: userId!,
          isPrivate: true,
          isShared: false,
          organizationId,
        })
        .returning()
      athenaFolderId = folder.id
    }
  }

  const file = await uploadVaultFile(
    fileUrl,
    fileName,
    fileType,
    fileSize,
    athenaFolderId!
  )
  
  revalidatePath(`/${getLocaleFromCookies()}/athena/${chatId}`)
  return file as VaultFile
}

export const uploadDocumentCreationFile = async (
  fileUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  folderId: string | null,
  documentCreationId: string
): Promise<VaultFile> => {
  let documentCreationFolderId = folderId
  
  if (!folderId) {
    const { userId, sessionClaims } = auth()
    //@ts-ignore
    const organizationId = sessionClaims?.o?.id || null
    
    // Build the where conditions based on whether organizationId exists
    const whereConditions = organizationId 
      ? and(
          eq(vault_folders.userId, userId!),
          eq(vault_folders.folderName, '(D) Document Files'),
          eq(vault_folders.organizationId, organizationId)
        )
      : and(
          eq(vault_folders.userId, userId!),
          eq(vault_folders.folderName, '(D) Document Files')
        )
    
    // First, check if a (D) Document Files folder already exists
    const existingFolder = await db.query.vault_folders.findFirst({
      where: whereConditions
    })
    
    if (existingFolder) {
      // Use the existing folder
      documentCreationFolderId = existingFolder.id
    } else {
      // Create a new folder only if it doesn't exist
      const [folder] = await db
        .insert(vault_folders)
        .values({
          folderName: '(D) Document Files',
          userId: userId!,
          isPrivate: true,
          isShared: false,
          organizationId: organizationId || undefined,
        })
        .returning()
      documentCreationFolderId = folder.id
    }
  }

  const file = await uploadVaultFile(
    fileUrl,
    fileName,
    fileType,
    fileSize,
    documentCreationFolderId!
  )
  
  revalidatePath(
    `/${getLocaleFromCookies()}/document-creation/${documentCreationId}`
  )
  return file as VaultFile
}

export const deleteFolders = async (ids: string[]) => {
  try {
    const locale = getLocaleFromCookies()
    const files = await db
      .select()
      .from(vault_files)
      .where(inArray(vault_files.folderId, ids))

    await db.delete(vault_folders).where(inArray(vault_folders.id, ids))
    await del(files.map((f) => f.storageUrl))
    revalidatePath(`/${locale}/vault`)
  } catch (e) {
    console.error(e)
  }
}

export const shareVaultFolder = async (
  folderId: string,
  organizationId: string
) => {
  const locale = getLocaleFromCookies()

  // Update the folder to mark it as shared
  await db
    .update(vault_folders)
    .set({
      isShared: true,
      organizationId,
    })
    .where(eq(vault_folders.id, folderId))

  // Add entry to sharing table
  await db
    .insert(vault_folder_sharing)
    .values({
      folderId,
      organizationId,
    })
    .onConflictDoNothing()

  revalidatePath(`/${locale}/vault`)
}

export const unshareVaultFolder = async (folderId: string) => {
  const locale = getLocaleFromCookies()

  // Update the folder to mark it as not shared
  await db
    .update(vault_folders)
    .set({
      isShared: false,
    })
    .where(eq(vault_folders.id, folderId))

  // Remove entries from sharing table
  await db
    .delete(vault_folder_sharing)
    .where(eq(vault_folder_sharing.folderId, folderId))

  revalidatePath(`/${locale}/vault`)
}

export const moveVaultFiles = async (
  fileIds: string[],
  targetFolderId: string
) => {
  try {
    const locale = getLocaleFromCookies()

    // Update the files to move them to the target folder
    await db
      .update(vault_files)
      .set({
        folderId: targetFolderId,
      })
      .where(inArray(vault_files.id, fileIds))

    // Revalidate both the target folder and the vault page
    revalidatePath(`/${locale}/vault/${targetFolderId}`)
    revalidatePath(`/${locale}/vault`)

    return { success: true }
  } catch (error) {
    console.error('Error moving files:', error)
    return { success: false, error: 'Failed to move files' }
  }
}

export const downloadVaultFile = async (fileId: string) => {
  try {
    const file = await db
      .select()
      .from(vault_files)
      .where(eq(vault_files.id, fileId))
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

const getLocaleFromCookies = () => {
  const cookieStore = cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')
  return localeCookie ? localeCookie.value : 'el' // Default to Greek
}

export const deleteVaultFiles = async (ids: string[]) => {
  try {
    const locale = getLocaleFromCookies()

    // Get files to delete
    const files = await db
      .select()
      .from(vault_files)
      .where(inArray(vault_files.id, ids))

    // Delete files from storage
    await del(files.map((f) => f.storageUrl))

    // Delete files from database
    await db.delete(vault_files).where(inArray(vault_files.id, ids))

    revalidatePath(`/${locale}/vault`)

    return { success: true }
  } catch (error) {
    console.error('Error deleting files:', error)
    return { success: false, error: 'Failed to delete files' }
  }
}
