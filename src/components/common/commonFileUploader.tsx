'use client'

import React, { useState } from 'react'
import { Button } from '../ui/button'
import { toast } from 'sonner'
import {
  Add,
  AddCircle,
  AddSquare,
  AttachCircle,
  AttachSquare,
  Paperclip,
  Paperclip2,
} from 'iconsax-react'
import { useDropzone } from 'react-dropzone'
import { useLocale, useTranslations } from 'next-intl'
import { calculatePageCount, getTotalTokensOfFiles } from '@/lib/doc_utils'
import {
  uploadVaultFile,
  uploadAthenaFile,
  uploadCaseFile,
  uploadContractFile,
  uploadDocumentCreationFile,
} from '@/app/[locale]/actions/vault_actions'
import { uploadLibraryFile } from '@/app/[locale]/actions/library_actions'
import { recordFileUploadUsage } from '@/app/[locale]/actions/subscription'
import { VaultFile, LibraryFile } from '@/lib/types/types'
import { PutBlobResult } from '@vercel/blob'
import { PaperclipIcon } from 'lucide-react'

interface CommonFileUploaderProps {
  uploadTarget: 'vault' | 'library'
  toolType?: 'athena' | 'case' | 'contract' | 'document_creation' | null // For vault uploads, determines default folder
  chatId?: string // Required for vault uploads with toolType
  folderId?: string | null // Optional specific folder ID
  subscriptionData: {
    subscriptionId: string
    uploadLimit: {
      totalLimit: number
      used: number
      isReached: boolean
    }
  }
  onUploadSuccess?: (files: VaultFile[] | LibraryFile[]) => void
  onUploadStart?: () => void
  onUploadComplete?: () => void
  disabled?: boolean
  className?: string
}

export const CommonFileUploader: React.FC<CommonFileUploaderProps> = ({
  uploadTarget,
  toolType = null,
  chatId,
  folderId = null,
  subscriptionData,
  onUploadSuccess,
  onUploadStart,
  onUploadComplete,
  disabled = false,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const locale = useLocale()
  const tToast = useTranslations('toast')

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: {
      'application/pdf': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        [],
      'image/jpeg': [],
      'image/png': [],
      'image/jpg': [],
    },
    onDrop: async (acceptedFiles: File[]) => {
      if (disabled || isUploading) return
      setIsUploading(true)
      console.log(folderId)

      const processToastId = toast.loading(
        tToast('fileUpload.processingFiles'),
        {
          duration: Infinity,
        }
      )

      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

      // Filter out files that exceed the maximum size
      const validFiles = acceptedFiles.filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(
            tToast('fileUpload.fileSizeExceeded', { fileName: file.name })
          )
          return false
        }
        return true
      })

      if (validFiles.length === 0) return

      // Calculate total pages
      let pagesCount = 0
      for (const file of validFiles) {
        const pageCount = await calculatePageCount(file)
        pagesCount += pageCount
      }

      // Check subscription limits
      if (
        pagesCount >
          subscriptionData.uploadLimit.totalLimit -
            subscriptionData.uploadLimit.used ||
        subscriptionData.uploadLimit.isReached
      ) {
        toast.error(tToast('fileUpload.uploadLimitReached'))
        return
      }

      // Check token limits
      try {
        const totalTokens = await getTotalTokensOfFiles(locale, validFiles)
        if (totalTokens > 100000) {
          toast.error(tToast('fileUpload.filesTooLarge'))
          return
        }
      } catch (error) {
        console.error('Error calculating tokens:', error)
        toast.error(tToast('fileUpload.uploadError'))
        return
      }

      onUploadStart?.()

      toast.dismiss(processToastId)

      // Show upload progress toast
      const uploadToastId = toast.loading(
        tToast('fileUpload.uploadingFiles', { count: validFiles.length }),
        { duration: Infinity }
      )

      try {
        const uploadedFiles: (VaultFile | LibraryFile)[] = []

        for (const file of validFiles) {
          // Upload to blob storage
          const response = await fetch(
            `/${locale}/api/upload_blob_vercel?folder=${uploadTarget}&filename=${file.name}`,
            {
              method: 'POST',
              body: file,
            }
          )

          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`)
          }

          const newBlob = (await response.json()) as PutBlobResult

          // Upload to appropriate service
          if (uploadTarget === 'vault') {
            let uploadedFile: VaultFile
            // Use specific upload functions based on toolType to get correct default folders
            if (toolType === 'athena' && chatId) {
              uploadedFile = await uploadAthenaFile(
                newBlob.url,
                file.name,
                file.type,
                file.size,
                folderId,
                chatId
              )
            } else if (toolType === 'case' && chatId) {
              uploadedFile = await uploadCaseFile(
                newBlob.url,
                file.name,
                file.type,
                file.size,
                folderId,
                chatId
              )
            } else if (toolType === 'contract' && chatId) {
              uploadedFile = await uploadContractFile(
                newBlob.url,
                file.name,
                file.type,
                file.size,
                folderId,
                chatId
              )
            } else if (toolType === 'document_creation' && chatId) {
              uploadedFile = await uploadDocumentCreationFile(
                newBlob.url,
                file.name,
                file.type,
                file.size,
                folderId,
                chatId
              )
            } else {
              // Fallback to generic uploadVaultFile
              if (!folderId) {
                throw new Error('Folder ID is required for vault uploads')
              }
              const result = await uploadVaultFile(
                newBlob.url,
                file.name,
                file.type,
                file.size,
                folderId
              )
              if (result) {
                uploadedFile = result as LibraryFile
              } else {
                throw new Error(`Failed to upload ${file.name} to vault`)
              }
            }

            uploadedFiles.push(uploadedFile)
          } else {
            if (!folderId) {
              throw new Error('Folder ID is required for library uploads')
            }
            const uploadResult = await uploadLibraryFile(
              newBlob.url,
              file.name,
              file.type,
              file.size,
              folderId
            )

            if (uploadResult.success) {
              // Create a LibraryFile object from the successful upload
              const libraryFile: LibraryFile = {
                id: uploadResult.fileId!,
                fileName: file.name,
                storageUrl: newBlob.url,
                createdAt: new Date(),
                fileType: file.type,
                fileSize: file.size.toString(),
                folderId: folderId,
                chunkIds: [], // Will be populated by the upload function
              }
              uploadedFiles.push(libraryFile)
            } else {
              throw new Error(
                uploadResult.error || 'Failed to upload to library'
              )
            }
          }
        }

        // Record usage
        await recordFileUploadUsage(
          subscriptionData.subscriptionId,
          pagesCount,
          chatId ? `lawbot/${chatId}` : uploadTarget
        )

        toast.dismiss(uploadToastId)
        toast.success(
          tToast('fileUpload.uploadSuccess', { count: validFiles.length })
        )

        onUploadSuccess?.(uploadedFiles)
      } catch (error) {
        console.error('Error uploading files:', error)
        toast.dismiss(uploadToastId)
        toast.error(tToast('fileUpload.uploadFailed'))
      } finally {
        setIsUploading(false)
        onUploadComplete?.()
      }
    },
    noClick: true,
    noKeyboard: true,
    multiple: true,
  })

  const handleClick = () => {
    if (!disabled && !isUploading) {
      open()
    }
  }

  return (
    <div
      {...getRootProps()}
      className={className}
    >
      <input {...getInputProps()} />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="rounded-full py-0 px-1 m-0"
        onClick={handleClick}
        disabled={disabled || isUploading}
      >
        <PaperclipIcon
          color={disabled || isUploading ? '#999999' : '#555555'}
          size={16}
          // variant="Bold"
        />
        {/* <p className="text-xs">{isUploading ? "Uploading..." : `Upload`}</p> */}
      </Button>
    </div>
  )
}

export default CommonFileUploader
