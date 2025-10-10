'use server'

import db from '@/db/drizzle'
import { toolFiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/**
 * Add a tool file record to track files used in various tools
 * @param toolName - The name of the tool (lawbot, case_study, contract_comparison, contract, document_creation)
 * @param fileSource - The source of the file (library, vault, upload)
 * @param chatId - The ID of the chat where the file is being used
 * @param fileId - The ID of the file (references vault_files.id, library_files.id, or uploaded file id)
 * @returns The created tool file record or error
 */
export async function addToolFile({
  toolName,
  fileSource,
  chatId,
  fileId,
}: {
  toolName:
    | 'lawbot'
    | 'case_study'
    | 'contract_comparison'
    | 'contract'
    | 'document_creation'
  fileSource: 'library' | 'vault' | 'upload'
  chatId: string
  fileId: string
}) {
  try {
    // Check if the tool file record already exists
    const existingRecord = await db
      .select()
      .from(toolFiles)
      .where(
        and(
          eq(toolFiles.toolName, toolName),
          eq(toolFiles.chatId, chatId),
          eq(toolFiles.fileId, fileId)
        )
      )
      .limit(1)

    if (existingRecord.length > 0) {
      return {
        success: true,
        data: existingRecord[0],
        message: 'Tool file record already exists',
      }
    }

    // Create new tool file record
    const newToolFile = await db
      .insert(toolFiles)
      .values({
        toolName,
        fileSource,
        chatId,
        fileId,
      })
      .returning()

    // Revalidate relevant paths
    revalidatePath('/lawbot')
    revalidatePath('/case-research')
    revalidatePath('/compare-contract')
    revalidatePath('/contract')
    revalidatePath('/document-creation')
    revalidatePath('/document-creation')
    revalidatePath('/document-creation')
    revalidatePath('/document-creation')

    return {
      success: true,
      data: newToolFile[0],
      message: 'Tool file record created successfully',
    }
  } catch (error) {
    console.error('Error adding tool file:', error)
    return {
      success: false,
      error: 'Failed to add tool file record',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Remove a tool file record
 * @param toolFileId - The ID of the tool file record to remove
 * @returns Success status or error
 */
export async function removeToolFile(toolFileId: string) {
  try {
    const deletedRecord = await db
      .delete(toolFiles)
      .where(eq(toolFiles.id, toolFileId))
      .returning()

    if (deletedRecord.length === 0) {
      return {
        success: false,
        error: 'Tool file record not found',
      }
    }

    // Revalidate relevant paths
    revalidatePath('/lawbot')
    revalidatePath('/case-research')
    revalidatePath('/compare-contract')
    revalidatePath('/contract')
    revalidatePath('/document-creation')

    return {
      success: true,
      data: deletedRecord[0],
      message: 'Tool file record removed successfully',
    }
  } catch (error) {
    console.error('Error removing tool file:', error)
    return {
      success: false,
      error: 'Failed to remove tool file record',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Remove tool file records by chat ID and file ID
 * This is useful when a file is removed from a specific chat
 * @param chatId - The chat ID
 * @param fileId - The file ID
 * @returns Success status or error
 */
export async function removeToolFileByIds({
  chatId,
  fileId,
}: {
  chatId: string
  fileId: string
}) {
  try {
    const deletedRecords = await db
      .delete(toolFiles)
      .where(and(eq(toolFiles.chatId, chatId), eq(toolFiles.fileId, fileId)))
      .returning()

    // Revalidate relevant paths
    revalidatePath('/lawbot')
    revalidatePath('/case-research')
    revalidatePath('/compare-contract')
    revalidatePath('/contract')
    revalidatePath('/document-creation')

    return {
      success: true,
      data: deletedRecords,
      message: `Removed ${deletedRecords.length} tool file record(s)`,
    }
  } catch (error) {
    console.error('Error removing tool files by IDs:', error)
    return {
      success: false,
      error: 'Failed to remove tool file records',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get tool files for a specific chat
 * @param chatId - The chat ID
 * @returns List of tool files or error
 */
export async function getToolFilesByChatId(chatId: string) {
  try {
    const chatToolFiles = await db
      .select()
      .from(toolFiles)
      .where(eq(toolFiles.chatId, chatId))
      .orderBy(toolFiles.createdAt)

    return {
      success: true,
      data: chatToolFiles,
    }
  } catch (error) {
    console.error('Error getting tool files by chat ID:', error)
    return {
      success: false,
      error: 'Failed to get tool files',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all tool files for a specific tool
 * @param toolName - The tool name
 * @returns List of tool files or error
 */
export async function getToolFilesByTool(
  toolName:
    | 'lawbot'
    | 'case_study'
    | 'contract_comparison'
    | 'contract'
    | 'document_creation'
) {
  try {
    const toolFilesList = await db
      .select()
      .from(toolFiles)
      .where(eq(toolFiles.toolName, toolName))
      .orderBy(toolFiles.createdAt)

    return {
      success: true,
      data: toolFilesList,
    }
  } catch (error) {
    console.error('Error getting tool files by tool:', error)
    return {
      success: false,
      error: 'Failed to get tool files',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
