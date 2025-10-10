'use client'
import React, { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { saveDocumentCreationFile } from '@/app/[locale]/actions/document_creation_actions'
import { Icons } from '@/components/icons'
import { DocumentCloud, TickCircle, Trash } from 'iconsax-react'
import { NextPage } from 'next'
import { useTranslations } from 'use-intl'
import { useUser } from '@clerk/nextjs'
import { UsageLimitsWithCheck } from '@/lib/types/types'
import { calculatePageCount } from '@/lib/doc_utils'
import { toast } from 'sonner'
import { recordFileUploadUsage } from '@/app/[locale]/actions/subscription'
import { set } from 'zod'

interface Props {
  documentCreationId: string
  subData: UsageLimitsWithCheck
}

interface UploadedFile {
  file: File
  uploading: boolean
  uploaded: boolean
  fileName: string
}

const UploadFile: NextPage<Props> = ({ documentCreationId, subData }) => {
  const t = useTranslations('documentCreation.docs')
  const tToast = useTranslations('toast')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [allUploaded, setAllUploaded] = useState(false) // Tracks if all files have been uploaded
  const { user } = useUser()

  // Dropzone hook for handling multiple file uploads
  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
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

        const newFiles = validFiles.map((file) => ({
          file,
          uploading: true,
          uploaded: false,
          fileName: file.name,
        }))

        setUploadedFiles((prevFiles) => [...prevFiles, ...newFiles])

        let pagesCount = 0

        for (const file of validFiles) {
          const pageCount = await calculatePageCount(file)
          pagesCount += pageCount
        }

        if (
          pagesCount >
            subData.uploadLimit.totalLimit - subData.uploadLimit.used ||
          subData.uploadLimit.isReached
        ) {
          toast.error(tToast('fileUpload.uploadLimitReached'))
          setUploadedFiles([])
          setAllUploaded(true)
          return
        }

        // Show upload progress toast
        const uploadToastId = toast.loading(
          tToast('fileUpload.uploadingFiles', { count: validFiles.length }),
          {
            duration: Infinity,
          }
        )

        try {
          const uploadPromises = validFiles.map(async (fl) => {
            const reader = new FileReader()
            return new Promise<void>((resolve, reject) => {
              reader.readAsDataURL(fl)
              reader.onload = async () => {
                try {
                  const fileBase64 = reader.result
                  await saveDocumentCreationFile({
                    documentCreationId,
                    base64Source: fileBase64 as string,
                    fileName: fl.name,
                    fileType: fl.name.split('.')[1],
                    fileSize: fl.size,
                    userId: user?.id || 'anonymous',
                  })

                  setUploadedFiles((prevFiles) =>
                    prevFiles.map((file) =>
                      file.fileName === fl.name
                        ? { ...file, uploading: false, uploaded: true }
                        : file
                    )
                  )
                  resolve()
                } catch (error) {
                  console.error('Error uploading file:', error)
                  reject(error)
                }
              }
              reader.onerror = reject
            })
          })

          await Promise.all(uploadPromises)

          await recordFileUploadUsage(
            subData.subscriptionId,
            pagesCount,
            `document-creation/${documentCreationId}`
          )

          // Dismiss loading toast and show success
          toast.dismiss(uploadToastId)
          toast.success(
            tToast('fileUpload.uploadSuccess', { count: validFiles.length })
          )
        } catch (error) {
          console.error('Error uploading files:', error)
          toast.dismiss(uploadToastId)
          toast.error(tToast('fileUpload.uploadFailed'))

          // Reset failed uploads
          setUploadedFiles((prevFiles) =>
            prevFiles.map((file) => ({
              ...file,
              uploading: false,
              uploaded: false,
            }))
          )
        }
      },
    })

  // Check if all files are uploaded
  useEffect(() => {
    if (
      uploadedFiles.length > 0 &&
      uploadedFiles.every((file) => file.uploaded)
    ) {
      setAllUploaded(true)
      // Remove all files after 1 second when all are uploaded
      setTimeout(() => {
        setUploadedFiles([])
        setAllUploaded(false)
      }, 1000)
    }
  }, [uploadedFiles])

  const baseClasses =
    'flex flex-col items-center justify-center py-4 border-2 border-dashed rounded-2xl transition-all cursor-pointer'
  const focusClasses = isFocused ? 'border-blue-500' : 'border-gray-300'
  const acceptClasses = isDragAccept ? 'border-green-500' : ''
  const rejectClasses = isDragReject ? 'border-red-500' : ''

  return (
    <div>
      <div className="container">
        <div
          {...getRootProps({
            className: `${baseClasses} ${focusClasses} ${acceptClasses} ${rejectClasses}`,
          })}
        >
          <input
            {...getInputProps()}
            multiple
          />
          <div className="flex flex-col justify-center items-center h-full">
            <DocumentCloud
              className="block"
              size={20}
            />
            <p
              className="text-center text-xs mt-1"
              dangerouslySetInnerHTML={{
                __html: t('uploadFile', { maxFiles: 50 }),
              }}
            ></p>
            <p className="text-xs text-slate-400 mt-1 font-light">
              {t('maxSize')}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {uploadedFiles.length > 0 ? (
          uploadedFiles.map((fileObj, index) => (
            <div
              key={index}
              className="text-xs border rounded-xl py-3 bg-zinc-100 px-4 flex justify-between font-light"
            >
              <div className="flex space-x-3 text-slate-600">
                {fileObj.uploading ? (
                  <Icons.spinner className="animate-spin h-4 w-4" />
                ) : fileObj.uploaded ? (
                  <TickCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Trash className="h-4 w-4 text-red-500" />
                )}
                <p>
                  {fileObj.uploading
                    ? t('uploading')
                    : fileObj.uploaded
                    ? t('uploaded')
                    : t('failed')}
                </p>
              </div>
              <p className="font-medium">{fileObj.fileName}</p>
            </div>
          ))
        ) : (
          <></>
        )}
      </div>
    </div>
  )
}

export default UploadFile
