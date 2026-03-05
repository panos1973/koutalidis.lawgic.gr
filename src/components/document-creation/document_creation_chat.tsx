/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
'use client'

import { Message, useChat } from 'ai/react'
import { Button } from '../ui/button'
import {
  ArrowUp,
  CloseCircle,
  Danger,
  DocumentDownload,
  DocumentText1,
  Setting2,
  TickCircle,
  Warning2,
  Document,
  DocumentCopy,
} from 'iconsax-react'
import { Icons } from '../icons'
import MessageTile from './messages/message_tile'
import React, { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useDropzone } from 'react-dropzone'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { NextPage } from 'next'

import {
  DocumentCreationFile,
  LibraryFile,
  LibraryFolderFiles,
  ToolFile,
  UsageLimitsWithCheck,
  VaultFile,
  VaultFolderFiles,
} from '@/lib/types/types'
import {
  addToolFile,
  removeToolFileByIds,
} from '@/app/[locale]/actions/misc_actions'
import {
  createMeaningfulDocumentCreationTitle,
  deleteDocumentCreationFile,
  getDocumentCreationPreferences,
  saveDocumentCreationFile,
  saveDocumentCreationMessage,
  updateDocumentCreationPreferences,
} from '@/app/[locale]/actions/document_creation_actions'
import { calculatePageCount, getTotalTokensOfFiles } from '@/lib/doc_utils'
import { recordFileUploadUsage } from '@/app/[locale]/actions/subscription'
import { chatModels } from '@/lib/consts'
import ResourcesMobile from './resources_mobile'
import { useLocale, useTranslations } from 'use-intl'
import { StopIcon } from '@radix-ui/react-icons'
import { exportAllMessages } from '../misc/export_all_messages'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import VaultFileSelector from '../vault/vault_file_selector'
import FileIconRenderer from '../vault/file_icons_renderer'

import LibraryFileSelector from '../library/lib_file_selector'
import TemplateModal from './template-modal'
import { uploadDocumentCreationFile } from '@/app/[locale]/actions/vault_actions'
import { PutBlobResult } from '@vercel/blob'
import TemplateInputRenderer from './custom_textarea'
import CommonFileUploader from '../common/commonFileUploader'
import {
  DocumentCreationTemplateKey,
  getAllDocumentCreationTemplates,
} from '@/lib/documentCreationTemplateUtils'

interface Props {
  documentCreationId: string
  prevMessages: Message[]
  files: DocumentCreationFile[]
  vaultFolderFiles: VaultFolderFiles[]
  libFolderFiles: LibraryFolderFiles[]
  subscriptionData: UsageLimitsWithCheck
  toolFiles: ToolFile[]
}

// New Mode Selector Component
const ModeSelector = ({
  selectedMode,
  onModeChange,
  t,
}: {
  selectedMode: 'single' | 'chapter'
  onModeChange: (mode: 'single' | 'chapter') => void
  t: any
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="px-3 py-2 h-8 rounded-full flex items-center gap-2"
              >
                {selectedMode === 'single' ? (
                  <Document size="16" />
                ) : (
                  <DocumentCopy size="16" />
                )}
                <span className="text-xs font-medium">
                  {selectedMode === 'single'
                    ? t('modeSelector.singleMode.title2')
                    : t('modeSelector.singleMode.title2')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56"
            >
              <DropdownMenuLabel>{t('modeSelector.title')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onModeChange('single')}
                className={selectedMode === 'single' ? 'bg-accent' : ''}
              >
                <div className="flex items-center space-x-2 cursor-pointer">
                  <div>
                    <div className="font-medium">
                      {t('modeSelector.singleMode.title')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('modeSelector.singleMode.description')}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onModeChange('chapter')}
                className={selectedMode === 'chapter' ? 'bg-accent' : ''}
              >
                <div className="flex items-center space-x-2 cursor-pointer">
                  <div>
                    <div className="font-medium">
                      {t('modeSelector.chapterMode.title')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('modeSelector.chapterMode.description')}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('modeSelector.tooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const DocumentCreationChat: NextPage<Props> = ({
  documentCreationId,
  prevMessages,
  files,
  vaultFolderFiles,
  libFolderFiles,
  subscriptionData,
  toolFiles,
}) => {
  const t = useTranslations('documentCreation.chat')
  const ts = useTranslations('subscription')
  const tToast = useTranslations('toast')
  const { user } = useUser()
  const defaultTemplates = getAllDocumentCreationTemplates()
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentCreationTemplateKey | null>(null)

  // // New state for mode selection
  // const [documentMode, setDocumentMode] = useState<'single' | 'chapter'>('single')
  const [includeLawbotAnswers, SetIncludeLawbotAnswers] =
    useState<boolean>(true)
  const [includeGreekLaws, setIncludeGreekLaws] = useState<boolean>(true)
  const [includeGreekCourtDecisions, setIncludeGreekCourtDecisions] =
    useState<boolean>(true)
  const [includeEuropeanLaws, setIncludeEuropeanLaws] = useState<boolean>(false)
  const [includeEuropeanCourtDecisions, setIncludeEuropeanCourtDecisions] =
    useState<boolean>(false)
  const [includeGreekBibliography, setIncludeGreekBibliography] =
    useState<boolean>(false)
  const [includeForeignBibliography, setIncludeForeignBibliography] =
    useState<boolean>(false)
  const [includeClientDocuments, setIncludeClientDocuments] =
    useState<boolean>(false)

  const [selectedVaultFiles, setSelectedVaultFiles] = useState<VaultFile[]>([])
  const [selectedLibFiles, setSelectedLibFiles] = useState<LibraryFile[]>([])

  // Initialize selected files from toolFiles
  useEffect(() => {
    const vaultFiles: VaultFile[] = []
    const libFiles: LibraryFile[] = []

    toolFiles.forEach((toolFile) => {
      if (toolFile.fileSource === 'vault') {
        // Find the corresponding vault file
        const vaultFile = vaultFolderFiles
          .flatMap((folder) => folder.vaultFiles)
          .find((file) => file.id === toolFile.fileId)
        if (vaultFile) {
          vaultFiles.push(vaultFile)
        }
      } else if (toolFile.fileSource === 'library') {
        // Find the corresponding library file
        const libFile = libFolderFiles
          .flatMap((folder) => folder.libraryFiles)
          .find((file) => file.id === toolFile.fileId)
        if (libFile) {
          libFiles.push(libFile)
        }
      }
    })

    setSelectedVaultFiles(vaultFiles)
    setSelectedLibFiles(libFiles)
  }, [toolFiles, vaultFolderFiles, libFolderFiles])

  // Helper function to add tool file
  const handleAddToolFile = async (
    fileId: string,
    fileSource: 'vault' | 'library'
  ) => {
    try {
      console.log('🧪 addToolFile input', {
        toolName: 'document_creation',
        fileSource,
        chatId: documentCreationId,
        fileId,
      })

      await addToolFile({
        toolName: 'document_creation',
        fileSource,
        chatId: documentCreationId,
        fileId,
      })
    } catch (error) {
      console.error('❌ Error adding tool file:', error)
    }
  }

  // Helper function to remove tool file
  const handleRemoveToolFile = async (
    fileId: string,
    fileSource: 'vault' | 'library'
  ) => {
    try {
      await removeToolFileByIds({
        chatId: documentCreationId,
        fileId,
      })
    } catch (error) {
      console.error('Error removing tool file:', error)
    }
  }
  const [selectedModel, setSelectedModel] = useState<string>(chatModels[1])
  const locale = useLocale()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [searchText, setSearchText] = useState<string | null>(null)
  const isUserScrollingRef = useRef(false)
  const messageBoxRef = useRef<any>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  // Dropzone hook for handling file uploads
  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: {
        'application/pdf': [],
        'application/msword': [],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          [],
        'text/plain': ['.txt'],
        'text/csv': ['.csv'],
        'image/jpeg': [],
        'image/png': [],
        'image/jpg': [],
      },
      onDragEnter: () => setIsDragActive(true),
      onDragLeave: () => setIsDragActive(false),
      onDrop: async (acceptedFiles: File[]) => {
        setIsDragActive(false)
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

        let pagesCount = 0

        for (const file of validFiles) {
          const pageCount = await calculatePageCount(file)
          pagesCount += pageCount
        }

        if (
          pagesCount >
            subscriptionData.uploadLimit.totalLimit -
              subscriptionData.uploadLimit.used ||
          subscriptionData.uploadLimit.isReached
        ) {
          toast.error(tToast('fileUpload.uploadLimitReached'))
          return
        }

        // Show persistent upload progress toast
        const uploadToastId = toast.loading(
          tToast('fileUpload.uploadingFiles', { count: validFiles.length }),
          {
            duration: Infinity, // Keep toast visible until manually dismissed
          }
        )

        try {
          const totalTokens = await getTotalTokensOfFiles(locale, validFiles)

          if (totalTokens > 150000) {
            toast.dismiss(uploadToastId)
            toast.error(tToast('fileUpload.filesTooLarge'))
            return
          }

          for (const file of validFiles) {
            const response = await fetch(
              `/${locale}/api/upload_blob_vercel?folder=vault&filename=${file.name}`,
              {
                method: 'POST',
                body: file,
              }
            )
            let newBlob = (await response.json()) as PutBlobResult
            const existingDocumentFolderId =
              vaultFolderFiles.find(
                (f) => f.folderName === '(D) Document Files'
              )?.id ?? null

            const uploadedDocument = await uploadDocumentCreationFile(
              (newBlob as PutBlobResult).url,
              file.name,
              file.type,
              file.size,
              existingDocumentFolderId,
              documentCreationId
            )

            setSelectedVaultFiles((prevFiles) => [
              ...prevFiles,
              uploadedDocument,
            ])

            // Save as tool file
            await handleAddToolFile(uploadedDocument.id, 'vault')
          }

          await recordFileUploadUsage(
            subscriptionData.subscriptionId,
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
          // Dismiss loading toast and show error
          toast.dismiss(uploadToastId)
          toast.error(tToast('fileUpload.uploadFailed'))
        }
      },
      noClick: true, // Prevent click to open file dialog
      noKeyboard: true, // Prevent keyboard activation
    })

  useEffect(() => {
    const loadPreferences = async () => {
      if (user?.id) {
        try {
          const prefs = await getDocumentCreationPreferences(user.id)
          setIncludeGreekLaws(prefs.includeGreekLaws)
          setIncludeGreekCourtDecisions(prefs.includeGreekCourtDecisions)
          setIncludeEuropeanLaws(prefs.includeEuropeanLaws)
          setIncludeEuropeanCourtDecisions(prefs.includeEuropeanCourtDecisions)
          setIncludeGreekBibliography(prefs.includeGreekBibliography)
          setIncludeForeignBibliography(prefs.includeForeignBibliography)
        } catch (error) {
          console.error('Error loading preferences:', error)
          toast.error(tToast('preferences.loadFailed'))
        }
      }
    }

    loadPreferences()
  }, [user?.id])

  const handlePreferenceChange = async (key: string, value: boolean) => {
    if (!user?.id) return

    try {
      await updateDocumentCreationPreferences(user.id, { [key]: value })
    } catch (error) {
      console.error('Error updating preferences:', error)
      toast.error(tToast('preferences.updateFailed'))
    }
  }

  const preferenceItems = [
    {
      key: 'includeGreekLaws',
      title: `${t('greekLawsTitle')}`,
      state: includeGreekLaws,
      setState: setIncludeGreekLaws,
      enabled: true,
    },
    {
      key: 'includeGreekCourtDecisions',
      title: `${t('greekCourtDecisionsTitle')}`,
      state: includeGreekCourtDecisions,
      setState: setIncludeGreekCourtDecisions,
      enabled: true,
    },
    {
      key: 'includeEuropeanLaws',
      title: `${t('europeanLawsTitle')}`,
      // state: includeEuropeanLaws,
      state: false,
      setState: setIncludeEuropeanLaws,
      enabled: false,
    },
    {
      key: 'includeEuropeanCourtDecisions',
      title: `${t('europeanCourtDecisionsTitle')}`,
      // state: includeEuropeanCourtDecisions,
      state: false,
      setState: setIncludeEuropeanCourtDecisions,
      enabled: false,
    },
  ]

  const openFileInChat = (filename: string, searchText: string) => {
    setSelectedFile(null)
    setSearchText('')

    setTimeout(() => {
      setSelectedFile(filename)
      setSearchText(searchText)
    }, 0)
  }

  const handleResetFileSelection = () => {
    setSelectedFile(null)
    setSearchText(null)
  }

  const scrollToBottom = () => {
    if (messageBoxRef.current) {
      messageBoxRef.current.scrollTo({
        top: messageBoxRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  const handleUserScroll = () => {
    if (messageBoxRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messageBoxRef.current
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50
      isUserScrollingRef.current = !isNearBottom
    }
  }

  const formRef = useRef<HTMLFormElement>(null)
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    data,
    append,
    setMessages,
    stop,
  } = useChat({
    api: `/${locale}/api/document-creation/chat`,
    maxSteps: 2,
    initialMessages: prevMessages,
    body: {
      documentCreationId,
      includeLawbotAnswers,
      selectedTemplate,
      userEmail: user?.emailAddresses?.[0]?.emailAddress || 'anonymous',
      userId: user?.id,
      subscriptionId: subscriptionData.subscriptionId,
      locale,
      fileChunkIds: selectedLibFiles.flatMap((f) => f.chunkIds),
      vaultFiles: selectedVaultFiles.flatMap((f) => {
        return {
          storageUrl: f.storageUrl,
          fileType: f.fileType,
        }
      }),
      preferences: {
        includeGreekLaws,
        includeGreekCourtDecisions,
        includeEuropeanLaws,
        includeEuropeanCourtDecisions,
        includeGreekBibliography,
        includeForeignBibliography,
      },
    },

    async onFinish(message: any, options: any) {
      console.log(options.finishReason)

      setSelectedTemplate(null)
      if (messages.length === 0 && message.content) {
        await createMeaningfulDocumentCreationTitle(
          documentCreationId,
          message.content
        )
      }

      if (
        options.finishReason === 'length' ||
        options.finishReason === 'unknown'
      ) {
        showContinueButton()
      }
      if (
        options.finishReason === 'stop' ||
        options.finishReason === 'length' ||
        options.finishReason === 'unknown'
      ) {
        await saveDocumentCreationMessage(
          documentCreationId,
          message.role,
          message.content
        )
      }
    },
  })
  const [documentFileData, setDocumentFileData] = useState<string[]>([])
  const [lawbotData, setLawbotData] = useState<string>('')
  const [showContinueMessage, setShowContinueMessage] = useState<boolean>(false)

  useEffect(() => {
    if (messageBoxRef.current) {
      messageBoxRef.current.addEventListener('scroll', handleUserScroll)
    }
    return () => {
      if (messageBoxRef.current) {
        messageBoxRef.current.removeEventListener('scroll', handleUserScroll)
      }
    }
  }, [])

  useEffect(() => {
    if (data && data.length > 0) {
      setDocumentFileData((data[0] as any).documentFileData)
    }
  }, [messages, data])

  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom()
    }
  }, [messages, showContinueMessage])

  const addTemplateMessage = async (key: DocumentCreationTemplateKey) => {
    if (selectedVaultFiles.length > 0) {
      setSelectedTemplate(key)

      // Find the template and get its name/title
      const template = defaultTemplates.find((t) => t.key === key)
      const templateName = template
        ? locale === 'el'
          ? template.title_greek || template.title
          : template.title
        : key

      const userMsg =
        locale === 'el'
          ? `Δημιουργήστε απάντηση βάσει του προτύπου ${templateName}` // Now using templateName
          : `Create response based on ${templateName} template`

      setInput(userMsg)

      // Position cursor at the end of the text after state update
      setTimeout(() => {
        const textarea = document.querySelector(
          'textarea'
        ) as HTMLTextAreaElement
        if (textarea) {
          textarea.focus()
          textarea.setSelectionRange(
            textarea.value.length,
            textarea.value.length
          )
        }
      }, 0)
    }
  }

  const submitMessage = async (e: any) => {
    if (selectedVaultFiles.length > 0) {
      if (e.keyCode == 13 && e.shiftKey == false) {
        e.preventDefault()
        e.stopPropagation()
        await saveDocumentCreationMessage(documentCreationId, 'user', input)
        handleSubmit()
        scrollToBottom()
      }
    }
  }

  const submitForm = async (e: any) => {
    if (selectedVaultFiles.length > 0 && input) {
      e.preventDefault()
      e.stopPropagation()
      await saveDocumentCreationMessage(documentCreationId, 'user', input)
      handleSubmit()
      scrollToBottom()
    }
  }

  const showContinueButton = () => {
    setShowContinueMessage(true)
  }

  const continueChat = () => {
    if (selectedVaultFiles.length > 0) {
      append({
        content: t('continueButton'),
        role: 'user',
      })
      setShowContinueMessage(false)
      scrollToBottom()
    }
  }

  return (
    <div className="flex">
      <div className="flex flex-col  justify-center items-center  h-[80svh] md:h-[93svh] px-4 md:px-12 w-full py-8 md:py-6 ">
        <div
          className=" overflow-y-scroll flex flex-col w-full "
          ref={messageBoxRef}
        >
          {messages.map((m: any) =>
            m.content.length > 0 ? (
              <MessageTile
                message={m}
                key={m.id}
                isGenerating={isLoading}
                append={append}
                documentCreationId={documentCreationId}
                onOpenFile={openFileInChat}
                scrollToBottom={scrollToBottom}
                defaultTemplates={defaultTemplates}
              />
            ) : (
              <p
                key={m.id}
                className="text-xs text-gray-600 mb-1 text-center"
              >
                {t('searching')}
              </p>
            )
          )}
          {showContinueMessage && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit py-2 px-4 rounded-full m-auto mb-2 text-[#9e3a34] "
              onClick={continueChat}
            >
              {t('continue')}
            </Button>
          )}
        </div>

        {!messages.length && (
          <div className="w-[70%] flex flex-col justify-center items-center">
            <div className="mb-4">
              <p className={`font-semibold text-sm text-center font-sans`}>
                {t('chatTitle')}
              </p>
              <p className={`text-xs text-gray-500 text-center mt-1 font-light font-sans`}>
                {t('chatDescription')}
              </p>
            </div>
          </div>
        )}

        <div className="w-[75%]">
          {messages.length > 0 && (
            <div
              className="text-right px-4 md:text-sm text-xs cursor-pointer my-1"
              onClick={() => exportAllMessages(messages, locale)}
            >
              <div className="flex flex-row items-end justify-end gap-2">
                <div className="hidden md:inline">
                  <DocumentDownload size="20" />
                </div>
                <div className="inline md:hidden">
                  <DocumentDownload size="16" />
                </div>
                {t('exportAllMessages')}
              </div>
            </div>
          )}
          {!subscriptionData.active_subscription && (
            <div className="flex space-x-2 items-center text-xs text-center mt-4 bg-red-100 max-w-fit p-2 m-auto mb-2 rounded-lg text-red-500 font-medium ">
              <Warning2
                size={20}
                variant="Bold"
              />
              <p>{ts('notSubscribed')}</p>
            </div>
          )}
          {subscriptionData.messageLimit.isReached && (
            <div className="flex space-x-2 items-center text-xs text-center mt-4 bg-red-100 max-w-fit p-2 m-auto mb-2 rounded-lg text-red-500 font-medium ">
              <Danger
                size={20}
                variant="Bold"
              />
              <p>{ts('limitReached')}</p>
            </div>
          )}
          <div
            {...getRootProps()}
            className={`rounded-2xl border-4 border-zinc-100  ${
              isDragActive
                ? 'border-2 border-dashed border-blue-200 bg-blue-50'
                : ''
            }`}
          >
            <div
              className="flex gap-2 px-4 pt-4 overflow-x-auto overflow-y-hidden pb-2 custom-horizontal-scroll"
              onWheel={(e) => {
                const container = e.currentTarget
                // Check if horizontal scrolling is needed
                if (container.scrollWidth > container.clientWidth) {
                  e.preventDefault()
                  container.scrollLeft += e.deltaY
                }
              }}
              style={{
                scrollbarWidth:
                  files.length +
                    selectedVaultFiles.length +
                    selectedLibFiles.length <=
                  5
                    ? 'none'
                    : 'thin',
              }}
            >
              {files.map((file) => (
                <div
                  key={file.id}
                  className="px-1 py-1 h-8 border rounded-lg flex justify-between items-center space-x-1 min-w-[120px] flex-shrink-0"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-4 w-4">
                      <FileIconRenderer fileType={file.file_type} />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-wrap">
                        {file.file_name.length > 15
                          ? file.file_name.substring(0, 15) + '..'
                          : file.file_name}
                      </p>
                      <p className="text-[8px] font-medium tracking-wider text-zinc-400 uppercase">
                        Document File
                      </p>
                    </div>
                  </div>
                  <Button
                    className="p-0 m-0 text-xs py-0 max-h-fit"
                    variant="ghost"
                    onClick={() =>
                      toast.promise(
                        deleteDocumentCreationFile(file.id, documentCreationId),
                        {
                          loading: 'Deleting File...',
                          success: 'File Deleted',
                          error: 'Something went wrong...',
                        }
                      )
                    }
                  >
                    <CloseCircle
                      size={16}
                      variant="Bulk"
                      color="#555555"
                    />
                  </Button>
                </div>
              ))}
              {selectedVaultFiles.map((file) => (
                <div
                  key={file.id}
                  className="px-1 py-1 h-8 border rounded-lg flex justify-between items-center space-x-1 min-w-[120px] flex-shrink-0"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-4 w-4">
                      <FileIconRenderer fileType={file.fileType} />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-wrap">
                        {file.fileName.length > 15
                          ? file.fileName.substring(0, 15) + '..'
                          : file.fileName}
                      </p>
                      <p className="text-[8px] font-medium tracking-wider text-zinc-400 uppercase">
                        Vault
                      </p>
                    </div>
                  </div>
                  {messages.length === 0 && (
                    <Button
                      className="p-0 m-0 text-xs py-0 max-h-fit"
                      variant="ghost"
                      onClick={async () => {
                        setSelectedVaultFiles((prev) =>
                          prev.filter((f) => f.id !== file.id)
                        )
                        await handleRemoveToolFile(file.id, 'vault')
                      }}
                    >
                      <CloseCircle
                        size={16}
                        variant="Bulk"
                        color="#555555"
                      />
                    </Button>
                  )}
                </div>
              ))}
              {selectedLibFiles.map((file) => (
                <div
                  key={file.id}
                  className="px-1 py-1 h-8 border rounded-lg flex justify-between items-center space-x-1 min-w-[120px] flex-shrink-0"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-4 w-4">
                      <FileIconRenderer fileType={file.fileType} />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-wrap">
                        {file.fileName.length > 15
                          ? file.fileName.substring(0, 15) + '..'
                          : file.fileName}
                      </p>
                      <p className="text-[8px] font-medium tracking-wider text-zinc-400 uppercase">
                        Library
                      </p>
                    </div>
                  </div>
                  {messages.length === 0 && (
                    <Button
                      className="p-0 m-0 text-xs py-0 max-h-fit"
                      variant="ghost"
                      onClick={async () => {
                        setSelectedLibFiles((prev) =>
                          prev.filter((f) => f.id !== file.id)
                        )
                        await handleRemoveToolFile(file.id, 'library')
                      }}
                    >
                      <CloseCircle
                        size={16}
                        variant="Bulk"
                        color="#555555"
                      />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <form
              ref={formRef}
              onSubmit={submitForm}
              className="px-4"
            >
              <div className="relative">
                <input {...getInputProps()} />
                <TemplateInputRenderer
                  input={input}
                  selectedTemplate={selectedTemplate ?? null}
                  locale={locale}
                  defaultTemplates={defaultTemplates}
                  onTemplateRemove={() => {
                    setSelectedTemplate(null)
                    setInput('')
                  }}
                  placeholder={t('chatPlaceholder')}
                  onChange={handleInputChange}
                  onKeyDown={submitMessage}
                  disabled={
                    selectedVaultFiles.length === 0 ||
                    !subscriptionData.active_subscription ||
                    subscriptionData.messageLimit.isReached
                  }
                  isDragActive={isDragActive}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex space-x-2 items-center">
                  <CommonFileUploader
                    uploadTarget="vault" // or "library"
                    toolType="document_creation"
                    folderId={
                      vaultFolderFiles.find(
                        (f) => f.folderName === '(D) Document Files'
                      )?.id ?? null
                    }
                    subscriptionData={subscriptionData}
                    onUploadSuccess={async (
                      files: VaultFile[] | LibraryFile[]
                    ) => {
                      console.log('Files uploaded:', files)

                      // Add vault files to selected files and handle tool files
                      if (files.length > 0 && 'storageUrl' in files[0]) {
                        const vaultFiles = files as VaultFile[]
                        setSelectedVaultFiles((prevFiles) => [
                          ...prevFiles,
                          ...vaultFiles,
                        ])

                        // Add each file as a tool file
                        for (const file of vaultFiles) {
                          await handleAddToolFile(file.id, 'vault')
                        }
                      } else {
                        // Handle library files if needed
                        const libFiles = files as LibraryFile[]
                        setSelectedLibFiles((prevFiles) => [
                          ...prevFiles,
                          ...libFiles,
                        ])

                        // Add each file as a tool file
                        for (const file of libFiles) {
                          await handleAddToolFile(file.id, 'library')
                        }
                      }
                    }}
                    onUploadStart={() => {
                      console.log('Upload started')
                    }}
                    onUploadComplete={() => {
                      console.log('Upload completed')
                    }}
                    disabled={false}
                    chatId={documentCreationId}
                  />
                  <VaultFileSelector
                    vaulFolderFiles={vaultFolderFiles}
                    selectedFiles={selectedVaultFiles}
                    setSelectedFiles={async (
                      files: VaultFile[] | ((prev: VaultFile[]) => VaultFile[])
                    ) => {
                      const newFiles =
                        typeof files === 'function'
                          ? files(selectedVaultFiles)
                          : files
                      const addedFiles = newFiles.filter(
                        (newFile) =>
                          !selectedVaultFiles.some(
                            (existing) => existing.id === newFile.id
                          )
                      )

                      // Add tool files for newly selected files
                      for (const file of addedFiles) {
                        await handleAddToolFile(file.id, 'vault')
                      }

                      setSelectedVaultFiles(newFiles)
                    }}
                  />
                  <LibraryFileSelector
                    libFolderFiles={libFolderFiles}
                    selectedFiles={selectedLibFiles}
                    setSelectedFiles={async (
                      files:
                        | LibraryFile[]
                        | ((prev: LibraryFile[]) => LibraryFile[])
                    ) => {
                      const newFiles =
                        typeof files === 'function'
                          ? files(selectedLibFiles)
                          : files
                      const addedFiles = newFiles.filter(
                        (newFile) =>
                          !selectedLibFiles.some(
                            (existing) => existing.id === newFile.id
                          )
                      )

                      // Add tool files for newly selected files
                      for (const file of addedFiles) {
                        await handleAddToolFile(file.id, 'library')
                      }

                      setSelectedLibFiles(newFiles)
                    }}
                  />

                  <TemplateModal
                    onTemplateSelect={(templateKey) => {
                      addTemplateMessage(
                        templateKey as DocumentCreationTemplateKey
                      )
                    }}
                  />

                  {/* <ModeSelector
                    selectedMode={documentMode}
                    onModeChange={setDocumentMode}
                    t={t}
                  /> */}
                </div>

                <div className="flex space-x-2">
                  {isLoading ? (
                    <div className="flex space-x-2">
                      <Icons.spinner
                        className="animate-spin m-auto h-5 w-5 text-zinc-600"
                        // color="#b8b9bc"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 bg-red-500 rounded-xl hover:bg-red-600"
                        type="button"
                        onClick={stop}
                      >
                        <StopIcon color="#FFFFFF" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2 bg-red-500 rounded-xl hover:bg-red-600"
                    >
                      <ArrowUp
                        size="20"
                        color="#FFFFFF"
                      />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
          <p className="lg:text-xs text-[10px] text-center py-1 font-light text-gray-500 md:mb-0 mb-2">
            {t('cautionMessage')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default DocumentCreationChat
