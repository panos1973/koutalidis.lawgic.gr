/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { Message, useChat } from 'ai/react'
import { Button } from '../ui/button'
import {
  ArrowDown,
  CloseCircle,
  DocumentDownload,
  Send2,
  TickCircle,
  Setting2,
  ArrowUp,
  Danger,
  Warning2,
  Timer,
} from 'iconsax-react'
import { Icons } from '../icons'
import MessageTile from './messages/message_tile'
import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  getLawbotPreferences,
  savePendingReferences,
  updateLawbotPreferences,
} from '@/app/[locale]/actions/chat_actions'
import { NextPage } from 'next'
import {
  addMessage,
  createMeaningfulchatTitle,
} from '@/app/[locale]/actions/chat_actions'
import ChatModelSelector from '../misc/chat_model_selector'
import { chatModels } from '@/lib/consts'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'use-intl'
import {
  addToolFile,
  removeToolFileByIds,
} from '@/app/[locale]/actions/misc_actions'
import { StopIcon } from '@radix-ui/react-icons'

import { exportAllMessages } from '../misc/export_all_messages'
import ResourcesManager from './resources_manager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Switch } from '../ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import VaultFileSelector from '../vault/vault_file_selector'
import {
  LibraryFile,
  LibraryFolderFiles,
  UsageLimitsWithCheck,
  VaultFile,
  VaultFolderFiles,
  ToolFile,
} from '@/lib/types/types'
import FileIconRenderer from '../vault/file_icons_renderer'
import Link from 'next/link'
import LibraryFileSelector from '../library/lib_file_selector'
import InternetSearchToggle from '../misc/internet-search-toggle'
import { useDropzone } from 'react-dropzone'
import { calculatePageCount, getTotalTokensOfFiles } from '@/lib/doc_utils'
import { PutBlobResult } from '@vercel/blob'
import { uploadAthenaFile } from '@/app/[locale]/actions/vault_actions'
import { recordFileUploadUsage } from '@/app/[locale]/actions/subscription'
import CommonFileUploader from '../common/commonFileUploader'

interface Props {
  chatId: string
  prevMessages: Message[]
  files: any
  vaultFolderFiles: VaultFolderFiles[]
  libFolderFiles: LibraryFolderFiles[]
  subscriptionData: UsageLimitsWithCheck
  toolFiles: ToolFile[]
}

const Chat: NextPage<Props> = ({
  chatId,
  prevMessages,
  files,
  vaultFolderFiles,
  libFolderFiles,
  subscriptionData,
  toolFiles,
}) => {
  const t = useTranslations('lawbot.chat')
  const ts = useTranslations('subscription')
  const tcase = useTranslations('caseResearch.chat')
  const tToast = useTranslations('toast')
  const formRef = useRef<HTMLFormElement>(null)
  const { user } = useUser()
  const [selectedModel, setSelectedModel] = useState<string>(chatModels[1])
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
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedVaultFiles, setSelectedVaultFiles] = useState<VaultFile[]>([])
  const [selectedLibFiles, setSelectedLibFiles] = useState<LibraryFile[]>([])
  const [searchText, setSearchText] = useState<string | null>(null)
  const [showContinueMessage, setShowContinueMessage] = useState<boolean>(false)
  const locale = useLocale()
  const isUserScrollingRef = useRef(false)
  const messageBoxRef = useRef<any>(null)
  const [fetchReferencesFlag, setFetchReferencesFlag] = useState(false)
  const [fetchReferencesFlagMessageTile, setFetchReferencesFlagMessageTile] =
    useState(false)
  const [referencesLoading, setReferencesLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedReference, setSelectedReference] = useState<string | null>(
    null
  )
  const [athenaDefaultFolderId, setAthenaDefaultFolderId] = useState<
    string | null
  >(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [searchInternet, setSearchInternet] = useState<boolean>(true)
  // Always set to false for detailed answers (removed user preference)
  const preferConciseAnswers = false

  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(
    null
  )
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false)

  const handleReferenceClick = (refId: string) => {
    setSelectedReference(refId)
  }

  const handleUploadClick = () => {
    setIsUploadModalOpen(true)
  }

  const resetFetchFlag = () => {
    setFetchReferencesFlag(false)
    setReferencesLoading(false)
  }
  const resetFetchFlagMessageTile = () => {
    setFetchReferencesFlagMessageTile(false)
  }

  useEffect(() => {
    const loadPreferences = async () => {
      if (user?.id) {
        try {
          const prefs = await getLawbotPreferences(user.id)
          setIncludeGreekLaws(prefs.includeGreekLaws)
          setIncludeGreekCourtDecisions(prefs.includeGreekCourtDecisions)
          setIncludeEuropeanLaws(prefs.includeEuropeanLaws)
          setIncludeEuropeanCourtDecisions(prefs.includeEuropeanCourtDecisions)
          setIncludeGreekBibliography(prefs.includeGreekBibliography)
          setIncludeForeignBibliography(prefs.includeForeignBibliography)
          // Removed preferConciseAnswers loading since we always want detailed answers
        } catch (error) {
          console.error('Error loading preferences:', error)
          toast.error(tToast('preferences.failedToLoad'))
        }
      }
    }

    loadPreferences()
  }, [user?.id])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (messageBoxRef.current) {
          setSavedScrollPosition(messageBoxRef.current.scrollTop)
        }
      } else {
        if (savedScrollPosition !== null && messageBoxRef.current) {
          setTimeout(() => {
            if (messageBoxRef.current && savedScrollPosition !== null) {
              messageBoxRef.current.scrollTop = savedScrollPosition
              setSavedScrollPosition(null)
            }
          }, 50) // Small delay to ensure DOM is ready
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [savedScrollPosition])

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
          toast.error(
            'Upload limit reached. Please upgrade your plan to upload more files.'
          )
          return
        }

        // Show upload progress toast that persists until completion
        const uploadToastId = toast.loading(
          `Uploading ${validFiles.length} file(s)...`,
          {
            duration: Infinity,
          }
        )

        try {
          const totalTokens = await getTotalTokensOfFiles(locale, validFiles)

          if (totalTokens > 100000) {
            toast.dismiss(uploadToastId)
            toast.error(
              'Files are too large. Please upload files with a total size of less than 450 pages.'
            )
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
            const exisitingContractFolderId =
              vaultFolderFiles.find((f) => f.folderName === '(D) Athena Files')
                ?.id ?? null

            const uploadedContract = await uploadAthenaFile(
              (newBlob as PutBlobResult).url,
              file.name,
              file.type,
              file.size,
              exisitingContractFolderId,
              chatId
            )

            setSelectedVaultFiles((prevFiles) => [
              ...prevFiles,
              uploadedContract,
            ])

            // Save as tool file
            await handleAddToolFile(uploadedContract.id, 'vault')
          }

          await recordFileUploadUsage(
            subscriptionData.subscriptionId,
            pagesCount,
            `lawbot/${chatId}`
          )

          toast.dismiss(uploadToastId)
          toast.success(
            tToast('fileUpload.uploadSuccess', { count: validFiles.length })
          )
        } catch (error) {
          console.error('Error uploading files:', error)
          toast.dismiss(uploadToastId)
          toast.error(tToast('fileUpload.uploadFailed'))
        }
      },
      noClick: true, // Prevent click to open file dialog
      noKeyboard: true, // Prevent keyboard activation
    })

  // Initialize selected files from existing tool files
  useEffect(() => {
    const initializeSelectedFiles = () => {
      const vaultFiles = toolFiles
        .filter((file) => file.fileSource === 'vault')
        .map((toolFile) => {
          const vaultFile = vaultFolderFiles
            .flatMap((folder) => folder.vaultFiles)
            .find((file) => file.id === toolFile.fileId)
          return vaultFile
        })
        .filter(Boolean) as VaultFile[]

      const libFiles = toolFiles
        .filter((file) => file.fileSource === 'library')
        .map((toolFile) => {
          const libFile = libFolderFiles
            .flatMap((folder) => folder.libraryFiles)
            .find((file) => file.id === toolFile.fileId)
          return libFile
        })
        .filter(Boolean) as LibraryFile[]

      setSelectedVaultFiles(vaultFiles)
      setSelectedLibFiles(libFiles)
    }

    initializeSelectedFiles()
  }, [toolFiles, vaultFolderFiles, libFolderFiles])

  // Add tool file management functions
  const handleAddToolFile = async (
    fileId: string,
    fileSource: 'library' | 'vault' | 'upload'
  ) => {
    try {
      const result = await addToolFile({
        toolName: 'lawbot',
        fileSource,
        chatId,
        fileId,
      })
      if (!result.success) {
        toast.error(tToast('fileUpload.failedToAddFile'))
      }
    } catch (error) {
      console.error('Error adding tool file:', error)
      toast.error(tToast('fileUpload.failedToAddFile'))
    }
  }

  const handleRemoveToolFile = async (fileId: string) => {
    try {
      await removeToolFileByIds({ chatId, fileId })
    } catch (error) {
      console.error('Error removing tool file:', error)
      toast.error(tToast('fileUpload.failedToRemoveFile'))
    }
  }

  // Add preference update handler (removed preferConciseAnswers handling)
  const handlePreferenceChange = async (key: string, value: boolean) => {
    if (!user?.id) return

    try {
      await updateLawbotPreferences(user.id, { [key]: value })
    } catch (error) {
      console.error('Error updating preferences:', error)
      toast.error(tToast('preferences.failedToUpdate'))
    }
  }

  const preferenceItems = [
    {
      key: 'includeGreekLaws',
      title: `${tcase('greekLawsTitle')}`,
      state: includeGreekLaws,
      setState: setIncludeGreekLaws,
      enabled: true,
    },
    {
      key: 'includeGreekCourtDecisions',
      title: `${tcase('greekCourtDecisionsTitle')}`,
      state: includeGreekCourtDecisions,
      setState: setIncludeGreekCourtDecisions,
      enabled: true,
    },
    {
      key: 'includeEuropeanLaws',
      title: `${tcase('europeanLawsTitle')}`,
      // state: includeEuropeanLaws,
      state: false,
      setState: setIncludeEuropeanLaws,
      enabled: false,
    },
    {
      key: 'includeEuropeanCourtDecisions',
      title: `${tcase('europeanCourtDecisionsTitle')}`,
      // state: includeEuropeanCourtDecisions,
      state: false,
      setState: setIncludeEuropeanCourtDecisions,
      enabled: false,
    },
    // {
    //   key: 'includeGreekBibliography',
    //   title: `${tcase('greekBibliographyTitle')}`,
    //   // state: includeGreekBibliography,
    //   state: false,
    //   setState: setIncludeGreekBibliography,
    //   enabled: false,
    // },
    // {
    //   key: 'includeForeignBibliography',
    //   title: `${tcase('foreignBibliographyTitle')}`,
    //   // state: includeForeignBibliography,
    //   state: false,
    //   setState: setIncludeForeignBibliography,
    //   enabled: false,
    // },
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

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    append,
  } = useChat({
    api: `/${locale}/api/chat`,
    maxSteps: 3,
    initialMessages: prevMessages,
    body: {
      chatId,
      searchInternet,
      model: selectedModel,
      locale,
      subscriptionId: subscriptionData.subscriptionId,
      userEmail: user?.emailAddresses?.[0]?.emailAddress || 'anonymous',
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
        preferConciseAnswers, // Always false for detailed answers
      },
    },
    onResponse(response: any) {
      setReferencesLoading(true)
      const runId = response.headers.get('Run-Id')
      console.log('on response runId', runId)
      if (runId) {
        setCurrentRunId(runId)
      }
      setIsStreaming(true)
      setShouldAutoScroll(true)
    },
    async onFinish(
      message: { content: string; role: string },
      options: { finishReason: string; usage: any }
    ) {
      console.log(options.finishReason)
      setIsStreaming(false)
      setShouldAutoScroll(false) // Disable auto-scroll when AI finishes

      console.log(options.usage)

      if (messages.length === 0 && message.content) {
        await createMeaningfulchatTitle(chatId, message.content)
      }

      if (
        options.finishReason === 'stop' ||
        options.finishReason === 'length' ||
        options.finishReason === 'unknown'
      ) {
        const savedMessage = await addMessage(
          chatId,
          message.role,
          message.content
        )
        // Add this: Save pending references with the new message ID
        if (savedMessage?.id) {
          await savePendingReferences(chatId, savedMessage.id)
          setReferencesLoading(false)
        }
        setFetchReferencesFlag(true)
        setFetchReferencesFlagMessageTile(true)
      }

      if (
        options.finishReason === 'length' ||
        options.finishReason === 'unknown'
      ) {
        showContinueButton()
      }
    },
  })

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

      if (savedScrollPosition !== null) {
        setSavedScrollPosition(null)
      }
    }
  }

  useEffect(() => {
    if (error) {
      console.log(error)
      toast.error(tToast('general.somethingWentWrong'))
    }
  }, [error, messages])

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

  // Auto-scroll
  useEffect(() => {
    if (
      (isLoading || isStreaming || shouldAutoScroll) &&
      !isUserScrollingRef.current &&
      savedScrollPosition === null
    ) {
      scrollToBottom()
    }
  }, [messages, isLoading, isStreaming, shouldAutoScroll, savedScrollPosition])

  useEffect(() => {
    if (
      showContinueMessage &&
      !isUserScrollingRef.current &&
      savedScrollPosition === null
    ) {
      scrollToBottom()
    }
  }, [showContinueMessage, savedScrollPosition])

  const submitMessage = async (e: any) => {
    if (e.keyCode == 13 && e.shiftKey == false) {
      e.preventDefault()
      e.stopPropagation()
      setReferencesLoading(true)
      setShouldAutoScroll(true)
      await addMessage(chatId, 'user', input)
      handleSubmit()
      scrollToBottom()
    }
  }

  const submitForm = async (e: any) => {
    if (input) {
      e.preventDefault()
      e.stopPropagation()
      setShouldAutoScroll(true) // Enable auto-scroll when user sends message
      await addMessage(chatId, 'user', input)
      handleSubmit()
      scrollToBottom()
    }
  }

  const showContinueButton = () => {
    setShowContinueMessage(true)
  }

  const continueChat = () => {
    setShouldAutoScroll(true) // Enable auto-scroll when user continues chat
    append({
      content: t('continueButton'),
      role: 'user',
    })
    setShowContinueMessage(false)
  }

  return (
    <div className="flex">
      <div className="flex flex-col justify-center items-center  h-[80svh] md:h-[93svh] px-2 md:px-12 w-[100svw] md:w-[75svw] py-8 md:py-6 md:mx-auto">
        <div
          className="overflow-y-scroll  flex flex-col w-full mb-2"
          ref={messageBoxRef}
        >
          {messages
            .filter(
              (m: { content: string | any[] }) =>
                m.content && m.content.length > 0
            )
            .map((m: Message) => (
              <MessageTile
                message={m}
                key={m.id}
                isGenerating={isLoading}
                runId={currentRunId}
                chatId={chatId}
                scrollToBottom={scrollToBottom}
                append={append}
                fetchReferencesFlagMessageTile={fetchReferencesFlagMessageTile}
                resetFetchFlagMessageTile={resetFetchFlagMessageTile}
                referencesLoading={referencesLoading}
              />
            ))}
          {!isStreaming && isLoading && (
            <p className="text-xs text-gray-599 mb-1 text-center">
              {t('searching')}
            </p>
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

        {/* {!messages.length && (
          <div className="flex justify-center items-center h-[93svh]">
            <div className="w-full md:w-[50%]">
              <div className="border rounded-xl px-8 py-6">
                <div className=" flex items-center justify-start space-x-4 w-full mb-8">
                  <p className="font-medium  text-sm w-[70%]">
                    {t("placeYourQuestionToGetStart")}
                  </p>
                  <ArrowDown />
                </div>

                <p className="font-medium mt-2 text-xs text-slate-500">
                  {t("continueMessage")}
                </p>
              </div>
            </div>
          </div>
        )} */}

        {messages.length === 0 && (
          <div className="mb-4 w-[75%]">
            <p className={`font-bold text-lg text-center`}>{t('chatTitle')}</p>
            <p className={`font-zinc-500 text-center mt-1 font-light`}>
              {t('chatDescription')}
            </p>
          </div>
        )}
        <div className="w-[75%] mt-2">
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
            className={`rounded-2xl border-4 border-zinc-100 m-auto  ${
              isDragActive
                ? 'border-2 border-dashed border-blue-200 bg-blue-50'
                : ''
            }`}
            {...getRootProps()}
          >
            <div className="grid grid-cols-3 gap-2 px-4 pt-4">
              {selectedVaultFiles.map((file) => (
                <div
                  key={file.id}
                  className="px-3 py-1 h-12 border rounded-lg flex justify-between items-center space-x-2"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-6 w-6">
                      <FileIconRenderer fileType={file.fileType} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-wrap">
                        {file.fileName.length > 15
                          ? file.fileName.substring(0, 15) + '..'
                          : file.fileName}
                      </p>
                      <p className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase">
                        Vault
                      </p>
                    </div>
                  </div>
                  <Button
                    className="p-0 m-0 text-xs py-0 max-h-fit"
                    variant="ghost"
                    onClick={async () => {
                      setSelectedVaultFiles((prev) =>
                        prev.filter((f) => f.id !== file.id)
                      )
                      await handleRemoveToolFile(file.id)
                    }}
                  >
                    <CloseCircle
                      size={20}
                      variant="Bulk"
                      color="#555555"
                    />
                  </Button>
                </div>
              ))}
              {selectedLibFiles.map((file) => (
                <div
                  key={file.id}
                  className="px-3 py-1 h-12 border rounded-lg flex justify-between items-center space-x-2"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-6 w-6">
                      <FileIconRenderer fileType={file.fileType} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-wrap">
                        {file.fileName.length > 15
                          ? file.fileName.substring(0, 15) + '..'
                          : file.fileName}
                      </p>
                      <p className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase">
                        Library
                      </p>
                    </div>
                  </div>
                  <Button
                    className="p-0 m-0 text-xs py-0 max-h-fit"
                    variant="ghost"
                    onClick={async () => {
                      setSelectedLibFiles((prev) =>
                        prev.filter((f) => f.id !== file.id)
                      )
                      await handleRemoveToolFile(file.id)
                    }}
                  >
                    <CloseCircle
                      size={20}
                      variant="Bulk"
                      color="#555555"
                    />
                  </Button>
                </div>
              ))}
            </div>

            <form
              ref={formRef}
              onSubmit={submitForm}
              className="px-4"
            >
              <input {...getInputProps()} />
              <textarea
                className="w-full bg-transparent focus:outline-none text-sm md:pt-4 pb-4 resize-none"
                value={input}
                placeholder={t('chatPlaceholder')}
                onChange={handleInputChange}
                onKeyDown={submitMessage}
                disabled={
                  !subscriptionData.active_subscription ||
                  subscriptionData.messageLimit.isReached
                }
              />

              <div className="flex items-center justify-between py-2">
                <div className="flex space-x-2 items-center">
                  {/* comment out to disable
                  <CommonFileUploader
                    uploadTarget="vault" // or "library"
                    toolType="athena"
                    folderId={
                      vaultFolderFiles.find(
                        (f) => f.folderName === '(D) Athena Files'
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
                    chatId={chatId}
                  />
                  */}

                  {/* VAULT FILE SELECTOR - COMMENTED OUT
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

                      // Find newly added files
                      const addedFiles = newFiles.filter(
                        (newFile) =>
                          !selectedVaultFiles.some(
                            (existingFile) => existingFile.id === newFile.id
                          )
                      )

                      // Find removed files
                      const removedFiles = selectedVaultFiles.filter(
                        (existingFile) =>
                          !newFiles.some(
                            (newFile) => newFile.id === existingFile.id
                          )
                      )

                      // Handle added files
                      for (const file of addedFiles) {
                        await handleAddToolFile(file.id, 'vault')
                      }

                      // Handle removed files
                      for (const file of removedFiles) {
                        await handleRemoveToolFile(file.id)
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

                      // Find newly added files
                      const addedFiles = newFiles.filter(
                        (newFile) =>
                          !selectedLibFiles.some(
                            (existingFile) => existingFile.id === newFile.id
                          )
                      )

                      // Find removed files
                      const removedFiles = selectedLibFiles.filter(
                        (existingFile) =>
                          !newFiles.some(
                            (newFile) => newFile.id === existingFile.id
                          )
                      )

                      // Handle added files
                      for (const file of addedFiles) {
                        await handleAddToolFile(file.id, 'library')
                      }

                      // Handle removed files
                      for (const file of removedFiles) {
                        await handleRemoveToolFile(file.id)
                      }

                      setSelectedLibFiles(newFiles)
                    }}
                  />
                  */}

                  <InternetSearchToggle
                    isEnabled={searchInternet}
                    setIsEnabled={setSearchInternet}
                  />
                  {/* 
                  <DropdownMenu>
                    <DropdownMenuTrigger className="text-xs rounded-full px-1 flex items-center">
                      <Timer
                        size={22}
                        color="#555555"
                        variant="Linear"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[240px]">
                      <DropdownMenuLabel>{t('Answer_Style')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        className="justify-between cursor-pointer"
                        onSelect={() => {
                          if (preferConciseAnswers) {
                            handlePreferenceChange(
                              'preferConciseAnswers',
                              false
                            )
                            toast.success(t('switchedToDetailedAnswers'))
                          }
                        }}
                      >
                        {t('detailedAnswers')}
                        {!preferConciseAnswers && (
                          <TickCircle
                            size="16"
                            color="#37d67a"
                            variant="Bulk"
                          />
                        )}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="justify-between cursor-pointer"
                        onSelect={() => {
                          if (!preferConciseAnswers) {
                            setPreferConciseAnswers(true)
                            handlePreferenceChange('preferConciseAnswers', true)
                            toast.success(t('switchedToConciseAnswers'))
                          }
                        }}
                      >
                        {t('conciseAnswers')}
                        {preferConciseAnswers && (
                          <TickCircle
                            size="16"
                            color="#37d67a"
                            variant="Bulk"
                          />
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu> */}

                  {/* <LibraryAndVaultFilesSelector
                    vaulFolderFiles={vaultFolderFiles}
                    selectedVaultFiles={selectedVaultFiles}
                    setSelectedVaultFiles={setSelectedVaultFiles}
                    libraryFolderFiles={libFolderFiles}
                    selectedLibFiles={selectedLibFiles}
                    setSelectedLibFiles={setSelectedLibFiles}
                  /> */}

                  {/* SETTINGS DROPDOWN - COMMENTED OUT
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={`text-xs rounded-full py-1 px-3 flex space-x-1 items-center justify-center border  `}
                    >
                      <Setting2 size={22} color="#555555" variant={"Linear"} />
                      <span>Settings</span>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="w-[260px]">
                      <DropdownMenuLabel className="text-xs px-2 flex md:space-x-2 items-center">
                        <p className="font-medium md:text-xs text-[10px] flex-1">
                          {preferenceItems.every((item) => !item.state)
                            ? tcase("disabled")
                            : tcase("enabled")}
                        </p>
                        {preferenceItems.every((item) => !item.state) ? (
                          <CloseCircle
                            size="18"
                            color="#e11c47"
                            variant="Bulk"
                          />
                        ) : (
                          <TickCircle
                            size="18"
                            color="#37d67a"
                            variant="Bulk"
                          />
                        )}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>
                        <p>{tcase("includeLawbotTitle")}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {preferenceItems.map((item, index) => (
                        <DropdownMenuItem
                          key={index}
                          className="justify-between"
                          onSelect={(e) => {
                            e.preventDefault();
                          }}
                        >
                          {item.title}
                          {item.enabled ? (
                            <Switch
                              checked={item.state}
                              onCheckedChange={(checked) => {
                                item.setState(checked);
                                handlePreferenceChange(item.key, checked);
                              }}
                            />
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Switch checked={false} disabled />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Coming Soon</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  */}
                </div>

                {/* Add this before the closing div of your Chat component */}
                {/* <UploadFile
                  chatId={chatId}
                  isOpen={isUploadModalOpen}
                  onClose={() => setIsUploadModalOpen(false)}
                  isFileUploaded={files.length > 0} // Add this line
                /> */}

                {isLoading ? (
                  <div className="flex space-x-2">
                    <Icons.spinner
                      className="animate-spin m-auto h-5 w-5 text-zinc-600"
                      // color="#b8b9bc"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2 bg-red-500 rounded-lg hover:bg-red-600"
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
            </form>
          </div>
          <p className="lg:text-xs text-[10px] text-center py-1 font-light text-gray-500 md:mb-0 mb-2">
            {t('cautionMessage')}
          </p>
        </div>
      </div>
      {files.length > 0 ? (
        <div className="hidden md:block w-[40%]">
          <ResourcesManager
            chatId={chatId}
            files={files}
            selectedFile={selectedFile}
            searchText={searchText}
            onCloseFile={handleResetFileSelection}
            fetchReferencesFlag={fetchReferencesFlag}
            resetFetchFlag={resetFetchFlag}
            referencesLoading={referencesLoading}
            selectedReference={selectedReference}
            onReferenceSelect={setSelectedReference}
            subData={subscriptionData}
          />
        </div>
      ) : (
        <></>
      )}
    </div>
  )
}

export default Chat
