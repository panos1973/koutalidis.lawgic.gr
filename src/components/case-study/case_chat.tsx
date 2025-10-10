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
  CaseStudyFile,
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
  createMeaningfulcaseResearchTitle,
  deleteCaseStudyFile,
  getCaseResearchPreferences,
  saveCaseFile,
  saveCaseMessage,
  updateCaseResearchPreferences,
} from '@/app/[locale]/actions/case_study_actions'
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
import {
  CaseResearchTemplateKey,
  getAllCaseResearchTemplates,
} from '@/lib/caseResearchTemplateUtils'
import TemplateModal from './template-modal'
import { uploadCaseFile } from '@/app/[locale]/actions/vault_actions'
import { PutBlobResult } from '@vercel/blob'
import TemplateInputRenderer from './custom_textarea'
import CommonFileUploader from '../common/commonFileUploader'

interface Props {
  caseId: string
  prevMessages: Message[]
  files: CaseStudyFile[]
  vaultFolderFiles: VaultFolderFiles[]
  libFolderFiles: LibraryFolderFiles[]
  subscriptionData: UsageLimitsWithCheck
  toolFiles: ToolFile[]
}

const CaseChat: NextPage<Props> = ({
  caseId,
  prevMessages,
  files,
  vaultFolderFiles,
  libFolderFiles,
  subscriptionData,
  toolFiles,
}) => {
  const t = useTranslations('caseResearch.chat')
  const ts = useTranslations('subscription')
  const tToast = useTranslations('toast')
  const { user } = useUser()
  const defaultTemplates = getAllCaseResearchTemplates()
  const [selectedTemplate, setSelectedTemplate] =
    useState<CaseResearchTemplateKey | null>(null)
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
      await addToolFile({
        toolName: 'case_study',
        fileSource,
        chatId: caseId,
        fileId,
      })
    } catch (error) {
      console.error('Error adding tool file:', error)
    }
  }

  // Helper function to remove tool file
  const handleRemoveToolFile = async (
    fileId: string,
    fileSource: 'vault' | 'library'
  ) => {
    try {
      await removeToolFileByIds({
        chatId: caseId,
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
            const exisitingCaseFolderId =
              vaultFolderFiles.find((f) => f.folderName === '(D) Case Files')
                ?.id ?? null

            const uploadedContract = await uploadCaseFile(
              (newBlob as PutBlobResult).url,
              file.name,
              file.type,
              file.size,
              exisitingCaseFolderId,
              caseId
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
            `contract/${caseId}`
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

        // try {
        //   for (const fl of validFiles) {
        //     const reader = new FileReader();
        //     reader.readAsDataURL(fl);
        //     reader.onload = async () => {
        //       const fileBase64 = reader.result;
        //       await saveCaseFile({
        //         caseStudyId: caseId,
        //         base64Source: fileBase64 as string,
        //         fileName: fl.name,
        //         fileType: fl.name.split(".")[1],
        //         fileSize: fl.size,
        //         userId: user?.id || "anonymous",
        //       });
        //     };
        //   }

        //   await recordFileUploadUsage(
        //     subscriptionData.subscriptionId,
        //     pagesCount,
        //     `case-research/${caseId}`
        //   );

        //   toast.success(`Successfully uploaded ${validFiles.length} file(s)!`);
        // } catch (error) {
        //   console.error("Error uploading files:", error);
        //   toast.error("Failed to upload files. Please try again.");
        // }
      },
      noClick: true, // Prevent click to open file dialog
      noKeyboard: true, // Prevent keyboard activation
    })

  useEffect(() => {
    const loadPreferences = async () => {
      if (user?.id) {
        try {
          const prefs = await getCaseResearchPreferences(user.id)
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
      await updateCaseResearchPreferences(user.id, { [key]: value })
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
    // {
    //   key: 'includeGreekBibliography',
    //   title: `${t('greekBibliographyTitle')}`,
    //   // state: includeGreekBibliography,
    //   state: false,
    //   setState: setIncludeGreekBibliography,
    //   enabled: false,
    // },
    // {
    //   key: 'includeForeignBibliography',
    //   title: `${t('foreignBibliographyTitle')}`,
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
  } = useChat({
    api: `/${locale}/api/case-study/chat`,
    maxToolRoundtrips: 1,
    initialMessages: prevMessages,
    body: {
      caseId,
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
        await createMeaningfulcaseResearchTitle(caseId, message.content)
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
        await saveCaseMessage(caseId, message.role, message.content)
      }
    },
  })
  const [caseFileData, setCaseFileData] = useState<string[]>([])
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
      setCaseFileData((data[0] as any).caseFileData)
    }
  }, [messages, data])

  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom()
    }
  }, [messages, showContinueMessage])

  const addTemplateMessage = async (key: CaseResearchTemplateKey) => {
    if (selectedVaultFiles.length > 0) {
      setSelectedTemplate(key)
      const userMsg =
        locale === 'el'
          ? `Δημιουργήστε απάντηση βάσει του προτύπου ${key}`
          : `Create response based on ${key} template`
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
        await saveCaseMessage(caseId, 'user', input)
        handleSubmit()
        scrollToBottom()
      }
    }
  }

  const submitForm = async (e: any) => {
    if (selectedVaultFiles.length > 0 && input) {
      e.preventDefault()
      e.stopPropagation()
      await saveCaseMessage(caseId, 'user', input)
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
                caseId={caseId}
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

        {/* {files.length === 0 && (
          <div className="flex justify-center items-center h-[93svh]">
            <div className="w-full md:w-[70%] ">
              <div className="border rounded-xl px-8 py-6 flex flex-col">
                <div className=" flex space-x-4 w-full mb-2">
                  <p className="font-medium text-sm w-[70%]">
                    {t("noDocsToChat")}
                  </p>
                </div>
                <ArrowRight className="hidden md:block" />
                <ArrowDown className="self-end md:hidden" />
              </div>
            </div>
          </div>
        )} */}

        {/* {files.length > 0 && messages.length < 1 && (
          <div className="p-4 border rounded-xl">
            <p className="text-sm font-semibold">Select a Template</p>
            <div className="grid grid-cols-3 gap-4 mt-2">
              {defaultTemplates.map((t) => (
                <div
                  key={t.key}
                  onClick={() => {
                    addTemplateMessage(t.key as CaseResearchTemplateKey);
                  }}
                  className="h-12 hover:cursor-pointer hover:bg-zinc-50 text-xs font-medium px-3 py-1 bg-zinc-100 rounded-lg flex items-center"
                >
                  {" "}
                  <p> {locale === "el" ? t.title_greek : t.title}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs mt-2">or</p>

            <div className=" flex space-x-4 w-full mb-2 mt-2">
              <p className="font-medium text-sm w-[70%]">
                {t("startAnalysisMessage")}
              </p>
            </div>
            <ArrowDown />
            <p className="font-medium mt-2 text-xs text-slate-500">
              {t("continueMessage")}
            </p>
          </div>
        )} */}

        {!messages.length && (
          <div className="w-[70%] flex flex-col justify-center items-center">
            <div className="mb-4">
              <p className={`font-bold text-lg text-center`}>
                {t('chatTitle')}
              </p>
              <p className={`font-zinc-500 text-center mt-1 font-light`}>
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
                        Case File
                      </p>
                    </div>
                  </div>
                  <Button
                    className="p-0 m-0 text-xs py-0 max-h-fit"
                    variant="ghost"
                    onClick={() =>
                      toast.promise(deleteCaseStudyFile(file.id, caseId), {
                        loading: 'Deleting File...',
                        success: 'File Deleted',
                        error: 'Something went wrong...',
                      })
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
                    toolType="case"
                    folderId={
                      vaultFolderFiles.find(
                        (f) => f.folderName === '(D) Case Files'
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
                    chatId={caseId}
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
                      addTemplateMessage(templateKey as CaseResearchTemplateKey)
                    }}
                  />
                  {/* 
                  <DropdownMenu>
                    <DropdownMenuTrigger className="text-xs rounded-full px-2 flex items-center ">
                      <Setting2 size={22} color="#555555" variant="Linear" />
                    </DropdownMenuTrigger>
                    <div className=" md:hidden ml-[50svw]">
                      <ResourcesMobile
                        caseId={caseId}
                        files={files}
                        subData={subscriptionData}
                      />
                    </div>
                    <DropdownMenuContent className="w-[220px]">
                      <DropdownMenuLabel className="text-xs px-2 flex md:space-x-2 items-center">
                        <p className="font-medium md:text-xs text-[10px] flex-1">
                          {preferenceItems.every((item) => !item.state)
                            ? t("disabled")
                            : t("enabled")}
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
                        <p>{t("includeLawbotTitle")}</p>
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
                  </DropdownMenu> */}
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

      {/* <div className="hidden md:block w-[40%]">
    
        <ResourcesManager
          caseStudyId={caseId}
          files={files}
          selectedFile={selectedFile}
          searchText={searchText}
          onCloseFile={handleResetFileSelection}
          subData={subscriptionData}
        />
      </div> */}
    </div>
  )
}

export default CaseChat
