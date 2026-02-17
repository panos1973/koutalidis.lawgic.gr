/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
'use client'
import { useChat } from 'ai/react'
import { Button } from '../ui/button'
import {
  ArrowUp,
  CloseCircle,
  Danger,
  DocumentDownload,
  DocumentText,
  MessageText,
  Setting2,
  TickCircle,
  Warning2,
} from 'iconsax-react'
import { Icons } from '../icons'
import MessageTile from './messages/message_tile'
import { useEffect, useRef, useState } from 'react'
import { NextPage } from 'next'
import {
  Contract,
  ContractDataField,
  ContractDraft,
  ContractFile,
  ContractSection,
  LibraryFile,
  LibraryFolderFiles,
  ToolFile,
  UsageLimitsWithCheck,
  VaultFile,
  VaultFolderFiles,
} from '@/lib/types/types'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { chatModels } from '@/lib/consts'
import { useLocale, useTranslations } from 'use-intl'
import { SelectGroup } from '@radix-ui/react-select'
import {
  addContractDraft,
  createMeaningfulContractTitle,
  getContractChatPreferences,
  saveContractDataFieldValue,
  updateContractChatPreferences,
} from '@/app/[locale]/actions/contract_action'
import { StopIcon } from '@radix-ui/react-icons'
import ContractResourcesMobile from './files/contract_file_manager_mobile'
import ContractResourcesManager from './files/contract_file_manager'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '../ui/input'
import { useDebouncedCallback } from 'use-debounce'
import Markdown from 'markdown-to-jsx'
import UploadContractFile from './files/upload_file'
import Link from 'next/link'
import { exportAllMessages } from '../misc/export_all_messages'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Switch } from '../ui/switch'
import { useUser } from '@clerk/nextjs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import LibraryFileSelector from '../library/lib_file_selector'
import VaultFileSelector from '../vault/vault_file_selector'
import { useDropzone } from 'react-dropzone'
import { calculatePageCount, getTotalTokensOfFiles } from '@/lib/doc_utils'
import { recordFileUploadUsage } from '@/app/[locale]/actions/subscription'
import FileIconRenderer from '../vault/file_icons_renderer'
import { PutBlobResult } from '@vercel/blob'
import { uploadContractFile } from '@/app/[locale]/actions/vault_actions'
import {
  addToolFile,
  removeToolFileByIds,
} from '@/app/[locale]/actions/misc_actions'
import CommonFileUploader from '../common/commonFileUploader'
import { exportContractChapters } from '../misc/exportContractChapters'
import { Message } from 'ai'

interface Props {
  contractId: string
  drafts: ContractDraft[]
  sections: ContractSection[]
  fields: ContractDataField[]
  contractFiles: any
  subscriptionData: UsageLimitsWithCheck
  vaultFolderFiles: VaultFolderFiles[]
  libFolderFiles: LibraryFolderFiles[]
  toolFiles: ToolFile[]
}
const ContractChat: NextPage<Props> = ({
  contractId,
  drafts,
  sections,
  fields,
  contractFiles,
  subscriptionData,
  vaultFolderFiles,
  libFolderFiles,
  toolFiles,
}) => {
  const t = useTranslations('contract.chat')
  const ts = useTranslations('subscription')
  const tToast = useTranslations('toast')
  const tHome = useTranslations('contract.home')
  const tcase = useTranslations('caseResearch.chat')
  const { user } = useUser()
  const [selectedVaultFiles, setSelectedVaultFiles] = useState<VaultFile[]>([])
  const [selectedLibFiles, setSelectedLibFiles] = useState<LibraryFile[]>([])
  const [chapterMode, setChapterMode] = useState(false)
  const [currentChapter, setCurrentChapter] = useState(1)
  const [isDragActive, setIsDragActive] = useState(false)

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
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [showPromptsModal, setShowPromptsModal] = useState<boolean>(false)
  const [selectedModel, setSelectedModel] = useState<string>(chatModels[1])
  const [showContinueMessage, setShowContinueMessage] = useState<boolean>(false)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const locale = useLocale()
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (user?.id) {
        try {
          const prefs = await getContractChatPreferences(user.id)
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

  // Initialize selected files from existing tool files
  useEffect(() => {
    const initializeSelectedFiles = () => {
      const vaultFiles: VaultFile[] = []
      const libFiles: LibraryFile[] = []

      toolFiles.forEach((toolFile) => {
        if (toolFile.fileSource === 'vault') {
          vaultFolderFiles.forEach((folder) => {
            const file = folder.vaultFiles.find((f) => f.id === toolFile.fileId)
            if (file) {
              vaultFiles.push(file)
            }
          })
        } else if (toolFile.fileSource === 'library') {
          libFolderFiles.forEach((folder) => {
            const file = folder.libraryFiles.find(
              (f) => f.id === toolFile.fileId
            )
            if (file) {
              libFiles.push(file)
            }
          })
        }
      })

      setSelectedVaultFiles(vaultFiles)
      setSelectedLibFiles(libFiles)
    }

    initializeSelectedFiles()
  }, [toolFiles, vaultFolderFiles, libFolderFiles])

  // Tool file management functions
  const handleAddToolFile = async (
    fileId: string,
    fileSource: 'vault' | 'library'
  ) => {
    try {
      await addToolFile({
        toolName: 'contract',
        fileSource,
        chatId: contractId,
        fileId,
      })
    } catch (error) {
      console.error('Error adding tool file:', error)
      toast.error(tToast('fileUpload.failedToAddFile'))
    }
  }

  const handleRemoveToolFile = async (fileId: string) => {
    try {
      await removeToolFileByIds({
        chatId: contractId,
        fileId,
      })
    } catch (error) {
      console.error('Error removing tool file:', error)
      toast.error(tToast('fileUpload.failedToRemoveFile'))
    }
  }

  // Add preference update handler
  const handlePreferenceChange = async (key: string, value: boolean) => {
    if (!user?.id) return

    try {
      await updateContractChatPreferences(user.id, { [key]: value })
    } catch (error) {
      console.error('Error updating preferences:', error)
      toast.error(tToast('preferences.updateFailed'))
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

  const exportSpecificContractAsDoc = async (file: {
    file_content: any
    file_blob: any
    file_name: any
  }) => {
    try {
      let fileContent = file.file_blob || file.file_content

      // Check if the content is Base64 and corresponds to an image
      const base64Pattern = /^data:image\/([a-zA-Z]+);base64,/
      if (base64Pattern.test(fileContent)) {
        // Extract MIME type and Base64 data
        const mimeType = fileContent.match(base64Pattern)[1]
        const base64Data = fileContent.replace(base64Pattern, '')

        // Convert Base64 to Blob and download the image
        const binaryData = atob(base64Data)
        const byteArray = new Uint8Array(binaryData.length)
        for (let i = 0; i < binaryData.length; i++) {
          byteArray[i] = binaryData.charCodeAt(i)
        }
        const blob = new Blob([byteArray], { type: `image/${mimeType}` })
        saveAs(blob, `${file.file_name}.${mimeType}`)
        toast.success(
          tToast('fileUpload.exportSuccess', { fileName: file.file_name })
        )
        return
      }
      // Convert `fileContent` to a string if it's a Blob or ArrayBuffer
      if (fileContent instanceof Blob) {
        // Handle Blob using FileReader
        fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsText(fileContent, 'utf-8')
        })
      } else if (fileContent instanceof ArrayBuffer) {
        // Handle ArrayBuffer directly with TextDecoder
        const textDecoder = new TextDecoder('utf-8')
        fileContent = textDecoder.decode(fileContent)
      }

      // Ensure `fileContent` is treated as a string
      if (typeof fileContent !== 'string') {
        console.error('file_content could not be converted to a string.')
        toast.error(tToast('fileUpload.processingFailed'))
        return
      }

      // Process as a Base64 string
      let base64Content = fileContent.split(',')[1]

      // Clean non-Base64 characters
      base64Content = base64Content.replace(/[^A-Za-z0-9+/=]/g, '')

      let binaryContent

      // Helper function to verify if content is a valid ZIP
      const isValidZip = (content: PizZip.LoadData) => {
        try {
          const testZip = new PizZip(content)
          return true
        } catch (error) {
          return false
        }
      }

      // Sequential decoding attempts
      try {
        binaryContent = atob(base64Content)
        if (!isValidZip(binaryContent)) {
          throw new Error('Invalid ZIP after atob decoding.')
        }
        console.log('Used atob for decoding.')
      } catch (error) {
        console.warn(
          'atob approach failed or produced invalid ZIP, trying UTF-8 encoding with decodeURIComponent...'
        )
        binaryContent = null
      }

      // UTF-8 encoding workaround
      if (!binaryContent) {
        try {
          binaryContent = decodeURIComponent(
            Array.from(atob(base64Content))
              .map(
                (char) =>
                  `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`
              )
              .join('')
          )
          if (!isValidZip(binaryContent)) {
            throw new Error('Invalid ZIP after UTF-8 workaround.')
          }
          console.log('Used UTF-8 encoding workaround with decodeURIComponent.')
        } catch (error) {
          console.warn(
            'UTF-8 encoding workaround failed or produced invalid ZIP, trying Buffer for Base64 decoding...'
          )
          binaryContent = null
        }
      }

      // Buffer decoding for UTF-8 support
      if (!binaryContent) {
        try {
          const byteArray = Uint8Array.from(
            Buffer.from(base64Content, 'base64')
          )
          binaryContent = new TextDecoder('utf-8').decode(byteArray)
          if (!isValidZip(binaryContent)) {
            throw new Error('Invalid ZIP after Buffer decoding.')
          }
          console.log('Used Buffer for Base64 decoding.')
        } catch (error) {
          console.warn(
            'Buffer decoding failed or produced invalid ZIP, attempting chunked decoding...'
          )
          binaryContent = null
        }
      }

      // Chunked decoding to skip corrupt parts
      if (!binaryContent) {
        console.log('Starting chunked decoding...')
        binaryContent = ''
        for (let i = 0; i < base64Content.length; i += 1000) {
          const chunk = base64Content.slice(i, i + 1000)
          try {
            const decodedChunk = atob(chunk)
            binaryContent += decodedChunk
            console.log(`Decoded chunk at ${i}-${i + 1000}:`, decodedChunk)
          } catch (err) {
            console.warn(`Skipping invalid chunk at ${i}-${i + 1000}`)
          }
        }
        if (!isValidZip(binaryContent)) {
          console.error('Chunked decoding still produced an invalid ZIP.')
          binaryContent = null
        } else {
          console.log('Used chunked atob decoding to handle corrupted parts.')
        }
      }

      // Final fallback: Save `file.file_content` directly
      if (!binaryContent) {
        console.warn(
          'All decoding attempts failed. Saving raw file_content as a plain text file.'
        )

        const blob = new Blob([file.file_content], { type: 'text/plain' })
        saveAs(blob, `${file.file_name}_raw_recovery.txt`)
        toast.warning('Partial file recovered as raw text content.')
        return
      }

      // Convert binary content to Uint8Array for PizZip 
      const byteArray = new Uint8Array(binaryContent.length)
      for (let i = 0; i < binaryContent.length; i++) {
        byteArray[i] = binaryContent.charCodeAt(i)
      }

      const zip = new PizZip(byteArray.buffer)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      })

      doc.render()

      const out = doc.getZip().generate({
        type: 'blob',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })

      saveAs(out, `${file.file_name}_${new Date().toLocaleTimeString()}.docx`)
      toast.success(
        tToast('fileUpload.exportSuccess', { fileName: file.file_name })
      )
    } catch (error) {
      console.error('Error exporting document:', error)
      toast.error(
        tToast('fileUpload.exportFailed', { fileName: file.file_name })
      )
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const handleClickOutside = (event: MouseEvent) => {
    if (!popoverRef.current?.contains(event.target as Node)) {
      setIsPopoverOpen(false)
    }
  }

  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPopoverOpen) {
      document.addEventListener('click', handleClickOutside)
    } else {
      document.removeEventListener('click', handleClickOutside)
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isPopoverOpen])

  const renderFileNames = () => {
    if (contractFiles.length === 1) {
      const file = contractFiles[0]
      return (
        <p
          className="text-xs underline cursor-pointer"
          onClick={() => exportSpecificContractAsDoc(file)}
        >
          {file.file_name}
        </p>
      )
    } else if (contractFiles.length > 1) {
      return (
        <div className="relative inline-block">
          <button
            className="text-xs text-nowrap underline cursor-pointer flex flex-row flex-nowrap gap-2 justify-evenly items-start"
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          >
            {contractFiles.length} files used for template{' '}
            <DocumentDownload size="16" />
          </button>
          {isPopoverOpen && (
            <div
              ref={popoverRef}
              className="absolute mt-2 w-[200px] bg-white border rounded shadow-lg z-10 text-sm"
            >
              <ul>
                {contractFiles.map((file: any) => (
                  <li
                    key={file.id}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                    onClick={() => exportSpecificContractAsDoc(file)}
                  >
                    <span>{file.file_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )
    } else {
      return null
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
    stop,
  } = useChat({
    api: `/${locale}/api/contracts/chat`,
    maxSteps: 3,
    initialMessages:
      drafts.map((d) => {
        return {
          content: d.draft,
          role: d.role,
          id: d.id,
          createdAt: d.createdAt,
        }
      }) ?? [],

    body: {
      contractId,
      model: selectedModel,
      contract: contractFiles?.file_content ?? null,
      contractFiles: contractFiles ?? [],
      selectedVaultFiles,
      subscriptionId: subscriptionData.subscriptionId,
      fields:
        fields?.map((f) => ({
          field_name: f.field_name,
          value: f.value,
        })) ?? null,
      locale,
      preferences: {
        includeGreekLaws,
        includeGreekCourtDecisions,
        includeEuropeanLaws,
        includeEuropeanCourtDecisions,
        includeGreekBibliography,
        includeForeignBibliography,
      },
    },

    async onFinish(message, options) {
      console.log(options.finishReason)

      if (messages.length === 0 && message.content) {
        await createMeaningfulContractTitle(contractId, message.content)
      }

      await addContractDraft(contractId, message.content, 'assistant')

      if (
        options.finishReason === 'length' ||
        options.finishReason === 'unknown'
      ) {
        showContinueButton()
      }
    },
  })

  const userMessagesRef = useRef<any>(null)
  const assistantMessagesRef = useRef<any>(null)
  const isUserScrollingRef = useRef(false)

  const scrollToBottom = () => {
    if (assistantMessagesRef.current) {
      assistantMessagesRef.current.scrollTo({
        top: assistantMessagesRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }
  const handleUserScroll = () => {
    if (assistantMessagesRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        assistantMessagesRef.current
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50
      isUserScrollingRef.current = !isNearBottom
    }
  }

  useEffect(() => {
    if (assistantMessagesRef.current) {
      assistantMessagesRef.current.addEventListener('scroll', handleUserScroll)
    }
    return () => {
      if (assistantMessagesRef.current) {
        assistantMessagesRef.current.removeEventListener(
          'scroll',
          handleUserScroll
        )
      }
    }
  }, [])
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom()
    }
  }, [messages, showContinueMessage])

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
        if (acceptedFiles.length > 3) {
          toast.error('Maximum 3 contracts for optimal synthesis')
          acceptedFiles = acceptedFiles.slice(0, 3)
        }
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

        // Show upload progress toast that persists until completion
        const uploadToastId = toast.loading(
          tToast('fileUpload.uploadingFiles', { count: validFiles.length }),
          {
            duration: Infinity,
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
            const exisitingContractFolderId =
              vaultFolderFiles.find((f) => f.folderName === 'Contracts')?.id ??
              null

            const uploadedContract = await uploadContractFile(
              (newBlob as PutBlobResult).url,
              file.name,
              file.type,
              file.size,
              exisitingContractFolderId,
              contractId
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
            `contract/${contractId}`
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

  useEffect(() => {
    if (userMessagesRef.current) {
      userMessagesRef.current.scrollTo({
        top: userMessagesRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, data, error])

  const showContinueButton = () => {
    setShowContinueMessage(true)
  }

  const handleAccordionToggle = () => {
    setFieldsOpen((prevState) => !prevState)
  }

  useEffect(() => {
    if (fieldsOpen && userMessagesRef.current) {
      userMessagesRef.current.scrollTop = userMessagesRef.current.scrollHeight
    }
  }, [fieldsOpen, messages])

  useEffect(() => {
    if (userMessagesRef.current) {
      userMessagesRef.current.scrollTop = userMessagesRef.current.scrollHeight
    }
  }, [messages, showPromptsModal])

  // Custom submit handler with chapter mode support
  const handleCustomSubmit = async (originalInput?: string) => {
    const messageText = originalInput || input
    
    // Add chapter mode prefix to the message
    const messageWithMode = chapterMode 
      ? `[CHAPTER ${currentChapter}] ${messageText}`
      : messageText
    
    // Save the modified message to draft
    await addContractDraft(contractId, messageWithMode, 'user')
    
    // Temporarily set the modified input for the submission
    setInput(messageWithMode)
    
    // Use setTimeout to ensure the state update happens before submit
    setTimeout(() => {
      handleSubmit()
      scrollToBottom()
      setInput('') // Clear after submission
    }, 0)
  }

  const submit = async (e: any) => {
    if (contractFiles) {
      if (e.keyCode == 13 && e.shiftKey == false) {
        e.preventDefault()
        e.stopPropagation()

        try {
          await handleCustomSubmit()
        } catch (error) {
          console.error('Error submitting the draft: ', error)
        }
      }
    }
  }

  const selectAprompt = (prompt: string) => {
    setInput(prompt)
    setShowPromptsModal(false)
  }

  const continueChat = () => {
    // Add chapter mode prefix to the continue message
    const messageWithMode = chapterMode 
      ? `[CHAPTER ${currentChapter}] ${t('continueButton')}`
      : t('continueButton')
    
    append({
      content: messageWithMode,
      role: 'user',
    })
    setShowContinueMessage(false)
  }

  const saveDataField = useDebouncedCallback(async (value) => {
    saveContractDataFieldValue(contractId, value.id, value.value)
  }, 1000)

  const submitMessage = async (e: any) => {
    if (selectedVaultFiles.length > 0) {
      if (e.keyCode == 13 && e.shiftKey == false) {
        e.preventDefault()
        e.stopPropagation()
        await handleCustomSubmit()
      }
    }
  }

  const submitForm = async (e: any) => {
    if (selectedVaultFiles.length > 0 && input) {
      e.preventDefault()
      e.stopPropagation()
      await handleCustomSubmit()
    }
  }

  return (
    <div className="flex border-t">
      {(!isMobile || (isMobile && contractFiles.length > 0)) && (
        <>
          <div className="py-4 px-4  flex flex-col justify-center items-center h-[93svh] w-full mx-auto">
            <div
              className="overflow-y-scroll flex flex-col w-full"
              ref={assistantMessagesRef}
            >
              {messages.map((m: Message) =>
                m.content.length > 0 ? (
                  <MessageTile
                    message={m}
                    key={m.id}
                    isGenerating={isLoading}
                    runId={null}
                  />
                ) : (
                  <p
                    key={m.id}
                    className="text-xs text-gray-599 mb-1 text-center"
                  >
                    {t('searching')}
                  </p>
                )
              )}
            </div>

            <div className="w-full  py-2">
              {showContinueMessage && (
                <div className="flex justify-center mb-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit py-2 px-4 rounded-full text-[#9e3a34]"
                    onClick={continueChat}
                  >
                    {t('continue')}
                  </Button>
                </div>
              )}

              {messages.length === 0 && (
                <div className="mb-4">
                  <p className={`font-bold text-lg text-center`}>
                    {tHome('chatTitle')}
                  </p>
                  <p className={`font-zinc-500 text-center mt-1 font-light`}>
                    {tHome('chatDescription')}
                  </p>
                </div>
              )}

              {messages.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 items-center justify-end mb-2 w-[75%] m-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs flex items-center gap-2"
                    onClick={() => exportContractChapters(messages, locale)}
                  >
                    <DocumentText size="16" />
                    {t('exportContract')}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs flex items-center gap-2"
                    onClick={() => exportAllMessages(messages, locale)}
                  >
                    <DocumentDownload size="16" />
                    {t('exportAllMessages')}
                  </Button>
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
                className={`rounded-2xl border-4 border-zinc-100 w-[75%] m-auto  ${
                  isDragActive
                    ? 'border-2 border-dashed border-blue-200 bg-blue-50'
                    : ''
                }`}
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
                </div>

                <form
                  ref={formRef}
                  onSubmit={submitForm}
                  className="px-4"
                >
                  <div>
                    <input {...getInputProps()} />
                    <textarea
                      className="w-full bg-transparent focus:outline-none text-sm md:pt-4 pb-4 resize-none"
                      value={input}
                      placeholder={
                        isDragActive
                          ? 'Drop files here...'
                          : t('chatPlaceholder')
                      }
                      onChange={handleInputChange}
                      onKeyDown={submitMessage}
                      disabled={
                        !subscriptionData.active_subscription ||
                        subscriptionData.messageLimit.isReached
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex space-x-2 items-center">
                      <CommonFileUploader
                        uploadTarget="vault"
                        toolType="contract"
                        folderId={
                          vaultFolderFiles.find(
                            (f) => f.folderName === '(D) Contracts'
                          )?.id ?? null
                        }
                        subscriptionData={subscriptionData}
                        onUploadSuccess={async (
                          files: VaultFile[] | LibraryFile[]
                        ) => {
                          console.log('Files uploaded:', files)

                          if (files.length > 0 && 'storageUrl' in files[0]) {
                            const vaultFiles = files as VaultFile[]
                            setSelectedVaultFiles((prevFiles) => [
                              ...prevFiles,
                              ...vaultFiles,
                            ])

                            for (const file of vaultFiles) {
                              await handleAddToolFile(file.id, 'vault')
                            }
                          } else {
                            const libFiles = files as LibraryFile[]
                            setSelectedLibFiles((prevFiles) => [
                              ...prevFiles,
                              ...libFiles,
                            ])

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
                        chatId={contractId}
                      />
                      <VaultFileSelector
                        vaulFolderFiles={vaultFolderFiles}
                        selectedFiles={selectedVaultFiles}
                        setSelectedFiles={async (
                          files:
                            | VaultFile[]
                            | ((prev: VaultFile[]) => VaultFile[])
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

                          for (const file of addedFiles) {
                            await handleAddToolFile(file.id, 'library')
                          }

                          setSelectedLibFiles(newFiles)
                        }}
                      />
                    </div>

                    <div className="flex space-x-2">
                      {isLoading ? (
                        <div className="flex space-x-2">
                          <Icons.spinner
                            className="animate-spin m-auto h-5 w-5 text-zinc-600"
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
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ContractChat
