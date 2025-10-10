/* eslint-disable react-hooks/exhaustive-deps */
'use client'
import { Message, useChat } from 'ai/react'
import { Button } from '../ui/button'
import {
  ArrowDown,
  ArrowRight,
  CloseCircle,
  DocumentDownload,
  Send2,
  Setting2,
  TickCircle,
} from 'iconsax-react'
import { Icons } from '../icons'
import MessageTile from './messages/message_tile'
import React, { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
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
import { VaultFile, VaultFolderFiles } from '@/lib/types/types'
import {
  createMeaningfulTool2Title,
  getTool2Preferences,
  saveToolMessage,
  updateTool2Preferences,
} from '@/app/[locale]/actions/tool_2_actions'
import { chatModels } from '@/lib/consts'
import ResourcesManager from './resources_manager'
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

interface Props {
  tool2Id: string
  prevMessages: Message[]
  files: []
  vaultFolderFiles: VaultFolderFiles[]
}

const Tool2Chat: NextPage<Props> = ({
  tool2Id,
  prevMessages,
  files,
  vaultFolderFiles,
}) => {
  const t = useTranslations('tool2.chat')
  const { user } = useUser()
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

  const [selectedFiles, setSelectedFiles] = useState<VaultFile[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(chatModels[1])
  const locale = useLocale()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [searchText, setSearchText] = useState<string | null>(null)
  const isUserScrollingRef = useRef(false)
  const messageBoxRef = useRef<any>(null)

  useEffect(() => {
    const loadPreferences = async () => {
      if (user?.id) {
        try {
          const prefs = await getTool2Preferences(user.id)
          setIncludeGreekLaws(prefs.includeGreekLaws)
          setIncludeGreekCourtDecisions(prefs.includeGreekCourtDecisions)
          setIncludeEuropeanLaws(prefs.includeEuropeanLaws)
          setIncludeEuropeanCourtDecisions(prefs.includeEuropeanCourtDecisions)
          setIncludeGreekBibliography(prefs.includeGreekBibliography)
          setIncludeForeignBibliography(prefs.includeForeignBibliography)
        } catch (error) {
          console.error('Error loading preferences:', error)
          toast.error('Failed to load preferences')
        }
      }
    }

    loadPreferences()
  }, [user?.id])

  const handlePreferenceChange = async (key: string, value: boolean) => {
    if (!user?.id) return

    try {
      await updateTool2Preferences(user.id, { [key]: value })
    } catch (error) {
      console.error('Error updating preferences:', error)
      toast.error('Failed to update preferences')
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
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    data,
    append,
  } = useChat({
    api: `/${locale}/api/tool-2/chat`,
    maxToolRoundtrips: 1,
    initialMessages: prevMessages,
    body: {
      tool2Id,
      includeLawbotAnswers,
      userEmail: user?.emailAddresses?.[0]?.emailAddress || 'anonymous',
      locale,
      fileChunkIds: selectedFiles.flatMap((f) => f.chunkIds),
      preferences: {
        includeGreekLaws,
        includeGreekCourtDecisions,
        includeEuropeanLaws,
        includeEuropeanCourtDecisions,
        includeGreekBibliography,
        includeForeignBibliography,
      },
    },

    async onFinish(
      message: { content: any; role: any },
      options: { finishReason: string }
    ) {
      console.log(options.finishReason)

      if (messages.length === 0 && message.content) {
        await createMeaningfulTool2Title(tool2Id, message.content)
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
        await saveToolMessage(tool2Id, message.role, message.content)
      }
    },
  })
  const [tool2FileData, setTool2FileData] = useState<string[]>([])
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
      setTool2FileData((data[0] as any).tool2FileData)
    }
  }, [messages, data])

  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom()
    }
  }, [messages, showContinueMessage])

  const submitMessage = async (e: any) => {
    if (files.length > 0) {
      if (e.keyCode == 13 && e.shiftKey == false) {
        e.preventDefault()
        e.stopPropagation()
        await saveToolMessage(tool2Id, 'user', input)
        handleSubmit()
        scrollToBottom()
      }
    }
  }

  const showContinueButton = () => {
    setShowContinueMessage(true)
  }

  const continueChat = () => {
    append({
      content: t('continueButton'),
      role: 'user',
    })
    setShowContinueMessage(false)
    scrollToBottom()
  }
  return (
    <div className="flex">
      <div className="flex flex-col justify-between h-[80svh] md:h-[93svh] px-4 md:px-12 w-full py-8 md:py-6 mx-auto stretch ">
        <div
          className="overflow-y-scroll no-scrollbar flex flex-col no-scrollbar"
          ref={messageBoxRef}
        >
          {messages.map((m: Message) =>
            m.content.length > 0 ? (
              <MessageTile
                message={m}
                key={m.id}
                isGenerating={isLoading}
                append={append}
                tool2Id={tool2Id}
                onOpenFile={openFileInChat}
                scrollToBottom={scrollToBottom}
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

        {messages.length === 0 && files.length > 0 && (
          <div className="flex justify-center items-center h-[93svh]">
            <div className="w-[70%]">
              <div className="border rounded-xl px-8 py-6">
                <div className=" flex space-x-4 w-full mb-2">
                  <p className="font-medium text-sm w-[70%]">
                    {t('startAnalysisMessage')}
                  </p>
                </div>
                <ArrowDown />
                <p className="font-medium mt-2 text-xs text-slate-500">
                  {t('continueMessage')}
                </p>
              </div>
            </div>
          </div>
        )}
        {files.length === 0 && (
          <div className="flex justify-center items-center h-[93svh]">
            <div className="w-full md:w-[70%] ">
              <div className="border rounded-xl px-8 py-6 flex flex-col">
                <div className=" flex space-x-4 w-full mb-2">
                  <p className="font-medium text-sm w-[70%]">
                    {t('noDocsToChat')}
                  </p>
                </div>
                <ArrowRight className="hidden md:block" />
                <ArrowDown className="self-end md:hidden" />
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0">
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

          <div className="rounded-2xl border w-[100%] md:shadow-2xl">
            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2 px-4 pt-4">
                {selectedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="px-3 py-1 h-12 border rounded-lg flex justify-between items-center space-x-2"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <div className="h-6 w-6">
                        <FileIconRenderer fileType={file.fileType} />
                      </div>
                      <p className="text-xs font-medium text-wrap">
                        {file.fileName.length > 15
                          ? file.fileName.substring(0, 15) + '..'
                          : file.fileName}
                      </p>
                    </div>
                    <Button
                      className="p-0 m-0 text-xs py-0 max-h-fit"
                      variant="ghost"
                      onClick={() => {
                        setSelectedFiles((prev) =>
                          prev.filter((f) => f.id !== file.id)
                        )
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
            )}
            <form
              onSubmit={handleSubmit}
              ref={formRef}
              className="flex items-center px-4"
            >
              <textarea
                className="w-full bg-transparent focus:outline-none text-sm pt-4 resize-none"
                value={input}
                placeholder={t('chatPlaceholder')}
                onChange={handleInputChange}
                disabled={!files.length}
                onKeyDown={submitMessage}
              />
              {isLoading ? (
                <div className="flex space-x-2">
                  <Icons.spinner
                    className="animate-spin m-auto h-6 w-6 text-red-600"
                    // color="#b8b9bc"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 border rounded-full h-6 w-6"
                    type="button"
                    onClick={stop}
                  >
                    <StopIcon color="#2e2d2d" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1"
                  disabled={!files.length}
                >
                  <Send2
                    size="22"
                    color="#2e2d2d"
                  />
                </Button>
              )}
            </form>
            <div className="bg-zinc-50 border-t border-zinc-100  md:px-4 px-0 py-1 rounded-b-2xl">
              <div className="relative flex flex-col lg:flex-row items-center py-1 min-h-[40px]">
                <div className="flex-shrink-0 flex lg:space-x-2 items-center lg:absolute lg:left-0 lg:ml-0 ">
                  {/* Vault Files Section */}

                  <VaultFileSelector
                    vaulFolderFiles={vaultFolderFiles}
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                  />
                  {/* Dropdown Menu Section */}

                  <DropdownMenu>
                    <DropdownMenuTrigger className="text-xs rounded-full px-2 flex items-center ">
                      <Setting2
                        size={22}
                        color="#555555"
                        variant="Linear"
                      />
                    </DropdownMenuTrigger>
                    <div className=" md:hidden ml-[50svw]">
                      <ResourcesMobile
                        tool2Id={tool2Id}
                        files={files}
                      />
                    </div>
                    <DropdownMenuContent className="w-[220px]">
                      <DropdownMenuLabel className="text-xs px-2 flex md:space-x-2 items-center">
                        <p className="font-medium md:text-xs text-[10px] flex-1">
                          {preferenceItems.every((item) => !item.state)
                            ? t('disabled')
                            : t('enabled')}
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
                        <p>{t('includeLawbotTitle')}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {preferenceItems.map((item, index) => (
                        <DropdownMenuItem
                          key={index}
                          className="justify-between"
                          onSelect={(e) => {
                            e.preventDefault()
                          }}
                        >
                          {item.title}
                          {item.enabled ? (
                            <Switch
                              checked={item.state}
                              onCheckedChange={(checked) => {
                                item.setState(checked)
                                handlePreferenceChange(item.key, checked)
                              }}
                            />
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Switch
                                      checked={false}
                                      disabled
                                    />
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
                </div>

                {/* Center Content Section */}
                <div className="flex-grow flex justify-center lg:pl-10 pl-0">
                  <p className="text-center text-xs font-light text-gray-500 lg:my-0 my-2">
                    {t('cautionMessage')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block w-[40%]">
        {/* <Button onClick={() => handleOpenFile('DPA Template 1 English.docx')}>
          Open DPA Template 1.docx
        </Button> */}
        <ResourcesManager
          tool2Id={tool2Id}
          files={files}
          selectedFile={selectedFile}
          searchText={searchText}
          onCloseFile={handleResetFileSelection}
        />
      </div>
    </div>
  )
}

export default Tool2Chat
