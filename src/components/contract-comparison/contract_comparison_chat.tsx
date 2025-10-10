/* eslint-disable react-hooks/exhaustive-deps */
'use client'
import { Message, useChat } from 'ai/react'
import { Button } from '../ui/button'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CloseCircle,
  DocumentDownload,
  DocumentText1,
  Send2,
  Setting2,
  TickCircle,
} from 'iconsax-react'
import { Icons } from '../icons'
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
import {
  ContractComparisonFile,
  UsageLimitsWithCheck,
  VaultFile,
  VaultFolderFiles,
} from '@/lib/types/types'
import {
  createMeaningfulTool2Title,
  getTool2Preferences,
  saveToolMessage,
  updateTool2Preferences,
} from '@/app/[locale]/actions/tool_2_actions'
import { chatModels } from '@/lib/consts'

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

import ContractCompareVaultFileSelector from './compare_vault_file_selector'
import {
  createMeaningfulComparisonTitle,
  deleteContractComparisonFile,
  saveContractComparisonMessage,
} from '@/app/[locale]/actions/contract_comparison_actions'
import MessageTile from '../tool-2/messages/message_tile'

interface Props {
  comparisonId: string
  prevMessages: Message[]
  files: ContractComparisonFile[]
  vaultFolderFiles: VaultFolderFiles[]
  subscriptionData: UsageLimitsWithCheck
  contractFiles: VaultFile[]
}

const ContractComparisonChat: NextPage<Props> = ({
  comparisonId,
  prevMessages,
  files,
  vaultFolderFiles,
  contractFiles,
  subscriptionData,
}) => {
  const t = useTranslations('tool2.chat')
  const tToast = useTranslations('toast')
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

  const [selectedFiles, setSelectedFiles] = useState<VaultFile[]>(contractFiles)
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
          toast.error(tToast('preferences.loadFailed'))
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
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    data,
    append,
  } = useChat({
    api: `/${locale}/api/contract-comparison/chat`,
    maxToolRoundtrips: 1,
    initialMessages: prevMessages,
    body: {
      comparisonId,
      includeLawbotAnswers,
      userEmail: user?.emailAddresses?.[0]?.emailAddress || 'anonymous',
      locale,
      subscriptionId: subscriptionData?.subscriptionId,
      contracts: selectedFiles.flatMap((f) => {
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

    async onFinish(message, options) {
      console.log(options.finishReason)

      if (messages.length === 0 && message.content) {
        await createMeaningfulComparisonTitle(comparisonId, message.content)
        console.log('title created')
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
        await saveContractComparisonMessage(
          comparisonId,
          message.role,
          message.content
        )
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
    if (selectedFiles.length === 2) {
      if (e.keyCode == 13 && e.shiftKey == false) {
        e.preventDefault()
        e.stopPropagation()
        await saveContractComparisonMessage(comparisonId, 'user', input)
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
    <div className="flex flex-col justify-center items-center h-[80svh] md:h-[93svh] px-4 md:px-12 w-full py-8 md:py-6 mx-auto">
      <div
        className="overflow-y-scroll flex flex-col w-full"
        ref={messageBoxRef}
      >
        {messages.map((m: Message) =>
          m.content.length > 0 ? (
            <MessageTile
              message={m}
              key={m.id}
              isGenerating={isLoading}
              append={append}
              // comparisonId={comparisonId}
              tool2Id={comparisonId}
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

      {/* {messages.length === 0 && selectedFiles.length === 2 && (
          <div className="flex justify-center items-center h-[93svh]">
            <div className="w-[70%]">
              <div className="border rounded-xl px-8 py-6">
                <div className=" flex space-x-4 w-full mb-2">
                  <p className="font-medium text-sm w-[70%]">
                    {t("startAnalysisMessage")}
                  </p>
                </div>
                <ArrowDown />
                <p className="font-medium mt-2 text-xs text-slate-500">
                  {t("continueMessage")}
                </p>
              </div>
            </div>
          </div>
        )}
        {selectedFiles.length !== 2 && (
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
      {messages.length === 0 && (
        <div className="mb-4 w-[75%]">
          <p className={`font-bold text-lg text-center`}>{t('chatTitle')}</p>
          <p className={`font-zinc-500 text-center mt-1 font-light`}>
            {t('chatDescription')}
          </p>
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

        <div className="rounded-2xl border-4 border-zinc-100 ">
          <div className="grid grid-cols-3 gap-2 px-4 pt-4">
            {/* Contract A slot */}
            {selectedFiles.length > 0 && selectedFiles[0] ? (
              <div
                key={selectedFiles[0].id}
                className="px-3 py-1 h-12 border rounded-lg flex justify-between items-center space-x-2"
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-6 w-6">
                    <FileIconRenderer fileType={selectedFiles[0].fileType} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-wrap">
                      {selectedFiles[0].fileName.length > 15
                        ? selectedFiles[0].fileName.substring(0, 15) + '..'
                        : selectedFiles[0].fileName}
                    </p>
                    <p className="text-xs text-zinc-500">{t('contract')} A</p>
                  </div>
                </div>
                <Button
                  className="p-0 m-0 text-xs py-0 max-h-fit"
                  variant="ghost"
                  onClick={async () => {
                    setSelectedFiles((prev) =>
                      prev.filter((f) => f.id !== selectedFiles[0].id)
                    )
                    await deleteContractComparisonFile(
                      selectedFiles[0].id,
                      comparisonId
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
            ) : (
              <ContractCompareVaultFileSelector
                vaulFolderFiles={vaultFolderFiles}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                contractIndex={1}
                comparisonId={comparisonId}
              />
            )}

            {/* Contract B slot */}
            {selectedFiles.length > 1 && selectedFiles[1] ? (
              <div
                key={selectedFiles[1].id}
                className="px-3 py-1 h-12 border rounded-lg flex justify-between items-center space-x-2"
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-6 w-6">
                    <FileIconRenderer fileType={selectedFiles[1].fileType} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-wrap">
                      {selectedFiles[1].fileName.length > 15
                        ? selectedFiles[1].fileName.substring(0, 15) + '..'
                        : selectedFiles[1].fileName}
                    </p>
                    <p className="text-xs text-zinc-500">{t('contract')} B</p>
                  </div>
                </div>
                <Button
                  className="p-0 m-0 text-xs py-0 max-h-fit"
                  variant="ghost"
                  onClick={async () => {
                    setSelectedFiles((prev) =>
                      prev.filter((f) => f.id !== selectedFiles[1].id)
                    )
                    await deleteContractComparisonFile(
                      selectedFiles[1].id,
                      comparisonId
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
            ) : (
              <ContractCompareVaultFileSelector
                vaulFolderFiles={vaultFolderFiles}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                contractIndex={2}
                comparisonId={comparisonId}
              />
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            ref={formRef}
            className="px-4"
          >
            <textarea
              className="w-full bg-transparent focus:outline-none text-sm pt-4 resize-none"
              value={input}
              placeholder={t('chatPlaceholder')}
              onChange={handleInputChange}
              disabled={
                !!selectedFile?.length ||
                selectedFiles.length < 2 ||
                !subscriptionData.active_subscription ||
                subscriptionData.messageLimit.isReached
              }
              onKeyDown={submitMessage}
            />
            <div className="flex items-center justify-end py-2 w-full">
              {/* <DropdownMenu>
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
                        ? t("disabled")
                        : t("enabled")}
                    </p>
                    {preferenceItems.every((item) => !item.state) ? (
                      <CloseCircle size="18" color="#e11c47" variant="Bulk" />
                    ) : (
                      <TickCircle size="18" color="#37d67a" variant="Bulk" />
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
      </div>
    </div>
  )
}

export default ContractComparisonChat
