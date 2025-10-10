import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { DocumentCloud, TickCircle } from 'iconsax-react'
import { Icons } from '@/components/icons'
import { saveChatFile } from '@/app/[locale]/actions/chat_actions'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'use-intl'

interface UploadedFile {
  file: File
  uploading: boolean
  uploaded: boolean
  fileName: string
}

interface UploadFileProps {
  chatId: string
  isOpen: boolean
  onClose: () => void
  onFileUploaded?: (fileName: string) => void
  isFileUploaded: boolean // Add this prop to track if a file is already uploaded
}

const UploadFile = ({
  chatId,
  isOpen,
  onClose,
  onFileUploaded,
  isFileUploaded,
}: UploadFileProps) => {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const t = useTranslations('caseResearch.docs')
  const translation = useTranslations('vault')

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Prevent upload if a file is already uploaded
      if (isFileUploaded) {
        toast.error('Only one file can be uploaded per chat')
        return
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

        if (file.size > MAX_FILE_SIZE) {
          toast.error('File size exceeds 10MB limit')
          return
        }

        setIsUploading(true)
        const newFile = {
          file,
          uploading: true,
          uploaded: false,
          fileName: file.name,
        }
        setUploadedFile(newFile)

        try {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          reader.onload = async () => {
            const fileBase64 = reader.result
            await saveChatFile({
              chatId,
              base64Source: fileBase64 as string,
              fileName: file.name,
              fileType: file.type.split('/')[1],
              fileSize: file.size,
            })

            setUploadedFile({ ...newFile, uploading: false, uploaded: true })
            onFileUploaded?.(file.name)
            toast.success('File uploaded successfully')

            // Close dialog after successful upload
            setTimeout(() => {
              onClose()
              setUploadedFile(null)
              setIsUploading(false)
            }, 1000)
          }
        } catch (error) {
          console.error('Upload error:', error)
          toast.error('Failed to upload file')
          setIsUploading(false)
        }
      }
    },
    [chatId, onClose, onFileUploaded, isFileUploaded]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        [],
      'image/jpeg': [],
      'image/png': [],
      'image/jpg': [],
    },
    multiple: false,
    onDrop,
    disabled: isUploading || isFileUploaded, // Disable dropzone if uploading or if file already exists
  })

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => !isUploading && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{translation('uploadFiles')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            } ${
              isUploading || isFileUploaded
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            <input {...getInputProps()} />
            <DocumentCloud
              size={24}
              className="mb-2"
            />
            <p
              className="text-center text-xs mt-1"
              dangerouslySetInnerHTML={{
                __html: isFileUploaded
                  ? t('uploadedChatFile')
                  : t('uploadChatFile', { maxFiles: 1 }),
              }}
            />
            <p className="text-xs text-gray-500">Max size: 10MB</p>
          </div>

          {uploadedFile && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {uploadedFile.uploading ? (
                  <Icons.spinner className="animate-spin h-4 w-4" />
                ) : (
                  <TickCircle
                    size={16}
                    className="text-green-500"
                  />
                )}
                <span className="text-sm">
                  {uploadedFile.uploading ? t('uploading') : 'Uploaded'}
                </span>
              </div>
              <span className="text-sm truncate max-w-[200px]">
                {uploadedFile.fileName}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUploading}
          >
            {translation('cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UploadFile
