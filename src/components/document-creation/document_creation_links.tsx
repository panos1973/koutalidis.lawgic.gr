'use client'

import { NextPage } from 'next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CloseCircle, Trash, Note, TickCircle } from 'iconsax-react'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePathname } from 'next/navigation'
import {
  cn,
  formatDateToCustomFormat,
  relativeTimeFromDates,
} from '@/lib/utils'
import { toast } from 'sonner'
import {
  deleteDocumentCreation,
  updateDocumentCreationNote,
} from '@/app/[locale]/actions/document_creation_actions'
import { DocumentCreation } from '@/lib/types/types'
import { Suspense, useState } from 'react'
import HistoryHeader from '../misc/history_header'
import { useLocale } from 'next-intl'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../ui/drawer'
import { Button } from '../ui/button'
import ChatHistoryLoader from '../chat/chat_history_loader'
import CreateNewDocumentCreation from './create_new_document_creation'

interface Props {
  documentCreations?: DocumentCreation[] // Made optional with ?
  documentCreationTranslations: {
    selectDocumentForChatHistory: string
    note?: string
    history: string
    massDelete: string
    cancel: string
    accept: string
    deleteConfirmation: string
    deleteToastSuccess: string
    deleteToastLoading: string
    massDeleteToastSuccess: string
    massDeleteToastLoading: string
  }
}

const DocumentCreationLinks: NextPage<Props> = ({
  documentCreations = [], // Default to empty array
  documentCreationTranslations,
}) => {
  const path = usePathname()
  const [selectedDocumentCreations, setSelectedDocumentCreations] = useState<
    string[]
  >([])
  const [isMassDelete, setIsMassDelete] = useState(false)
  const [visibleNoteDocumentCreationId, setVisibleNoteDocumentCreationId] =
    useState<string | null>(null)
  const [notes, setNotes] = useState<{ [documentCreationId: string]: string }>(
    {}
  )
  const locale = useLocale() || 'el'

  // Early return if documentCreations is still undefined/null
  if (!documentCreations) {
    return (
      <div>
        <div className="md:hidden flex w-full justify-between px-4 py-2">
          <CreateNewDocumentCreation />
        </div>
        <div className="md:block hidden">{/* Empty state */}</div>
      </div>
    )
  }

  const handleDocumentCreationSelection = (documentCreationId: string) => {
    setSelectedDocumentCreations((prev) =>
      prev.includes(documentCreationId)
        ? prev.filter((id) => id !== documentCreationId)
        : [...prev, documentCreationId]
    )
  }

  const handleMassDelete = async () => {
    try {
      await toast.promise(
        Promise.all(
          selectedDocumentCreations.map((documentCreationId) =>
            deleteDocumentCreation(documentCreationId)
          )
        ),
        {
          loading: `${documentCreationTranslations.massDeleteToastLoading}...`,
          success: documentCreationTranslations?.massDeleteToastSuccess,
          error: "Oops! Couldn't Delete, try again",
        }
      )
      setSelectedDocumentCreations([])
      setIsMassDelete(false)
    } catch {
      toast.error(
        'Failed to delete selected document creations, please try again.'
      )
    }
  }

  const toggleNoteVisibility = (documentCreationId: string) => {
    setVisibleNoteDocumentCreationId((prev) =>
      prev === documentCreationId ? null : documentCreationId
    )
  }

  const handleSaveNote = async (documentCreationId: string, note: string) => {
    try {
      await updateDocumentCreationNote(documentCreationId, note)
      setNotes((prevNotes) => ({
        ...prevNotes,
        [documentCreationId]: note,
      }))
      toast.success('Note saved successfully.')
    } catch (error) {
      toast.error('Failed to save the note. Please try again.')
    }
    setVisibleNoteDocumentCreationId(null)
  }

  const renderDocumentCreationContent = (
    documentCreation: DocumentCreation
  ) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-1/2">
            <p className="text-xs font-medium line-clamp-2">
              {documentCreation.title}
            </p>
            {documentCreation.note && (
              <p className="text-[11px] text-[#c2032f] my-1">
                {documentCreation.note}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              {formatDateToCustomFormat(documentCreation.createdAt!)}
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 w-[280px]">
          <p>{documentCreation.title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const renderNoteEditingContent = (documentCreation: DocumentCreation) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-1/2">
            <p className="text-xs font-medium line-clamp-2">
              {documentCreation.title}
            </p>
            <input
              type="text"
              maxLength={80}
              placeholder={documentCreationTranslations?.note}
              value={notes[documentCreation.id] || documentCreation.note || ''}
              onChange={(e) =>
                setNotes((prevNotes) => ({
                  ...prevNotes,
                  [documentCreation.id]: e.target.value,
                }))
              }
              className="w-full text-[11px] text-[#c2032f] placeholder:text-[#c2032f] border-b border-dashed border-[#c2032f] bg-transparent focus:outline-none focus:border-solid my-1"
            />
            <p className="text-[11px] text-slate-500">
              {formatDateToCustomFormat(documentCreation.createdAt!)}
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 w-[280px]">
          <p>{documentCreation.title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <div>
      <div className="md:hidden flex w-full justify-between px-4 py-2">
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
            >
              {documentCreationTranslations?.history}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="relative flex flex-col items-center">
              <DrawerClose asChild>
                <button className="absolute right-2 top-1 md:hidden">
                  <CloseCircle className="h-6 w-6" />
                </button>
              </DrawerClose>
              <DrawerTitle className="w-full text-center">
                {documentCreationTranslations?.history}
              </DrawerTitle>
              <DrawerDescription>
                {documentCreationTranslations?.selectDocumentForChatHistory}
              </DrawerDescription>
            </DrawerHeader>
            <Suspense fallback={<ChatHistoryLoader />}>
              <div className="overflow-y-scroll max-h-[83svh] no-scrollbar ">
                {documentCreations.length > 0 && (
                  <HistoryHeader
                    selectedChats={selectedDocumentCreations}
                    handleMassDelete={handleMassDelete}
                    setSelectedChats={setSelectedDocumentCreations}
                    isMassDelete={isMassDelete}
                    setIsMassDelete={setIsMassDelete}
                    chatHistoryTranslations={documentCreationTranslations}
                  />
                )}

                {documentCreations.map((documentCreation) => (
                  <div
                    className={cn(
                      'py-3 hover:cursor-pointer px-2 flex flex-col justify-center items-center',
                      {
                        'border-r-2 border-primary bg-slate-200': path.endsWith(
                          documentCreation.id
                        ),
                        'bg-red-100 border-l-4 border-red-500':
                          isMassDelete &&
                          selectedDocumentCreations.includes(
                            documentCreation.id
                          ),
                      }
                    )}
                    key={documentCreation.id}
                  >
                    <div className="flex space-x-4 justify-between items-center w-full">
                      {visibleNoteDocumentCreationId === documentCreation.id ? (
                        <Link
                          href={`/${locale}/document-creation/${documentCreation.id}`}
                          className="w-full"
                        >
                          <div className="w-full">
                            {renderNoteEditingContent(documentCreation)}
                          </div>
                        </Link>
                      ) : isMassDelete ? (
                        <div
                          className="w-full cursor-pointer"
                          onClick={() =>
                            handleDocumentCreationSelection(documentCreation.id)
                          }
                        >
                          <div className="w-full">
                            {renderDocumentCreationContent(documentCreation)}
                          </div>
                        </div>
                      ) : (
                        <DrawerClose asChild>
                          <Link
                            href={`/${locale}/document-creation/${documentCreation.id}`}
                            className="w-full"
                          >
                            <div className="w-full">
                              {renderDocumentCreationContent(documentCreation)}
                            </div>
                          </Link>
                        </DrawerClose>
                      )}

                      {!isMassDelete && (
                        <div className="flex items-center space-x-2">
                          {visibleNoteDocumentCreationId ===
                          documentCreation.id ? (
                            <TickCircle
                              size={15}
                              className="cursor-pointer"
                              onClick={() =>
                                handleSaveNote(
                                  documentCreation.id,
                                  notes[documentCreation.id] ||
                                    documentCreation.note ||
                                    ''
                                )
                              }
                            />
                          ) : (
                            <Note
                              size={15}
                              className="cursor-pointer"
                              onClick={() =>
                                toggleNoteVisibility(documentCreation.id)
                              }
                            />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Trash
                                size={15}
                                variant="Broken"
                                className="cursor-pointer"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                className="text-xs"
                                onClick={() => {
                                  toast.promise(
                                    deleteDocumentCreation(
                                      documentCreation?.id
                                    ),
                                    {
                                      loading: `${documentCreationTranslations?.deleteToastLoading}...`,
                                      success:
                                        documentCreationTranslations?.deleteToastSuccess,
                                      error: "Oops! Couldn't Delete, try again",
                                    }
                                  )
                                }}
                              >
                                {
                                  documentCreationTranslations?.deleteConfirmation
                                }
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Suspense>
            <DrawerFooter>{/* Add footer buttons if needed */}</DrawerFooter>
          </DrawerContent>
        </Drawer>
        <CreateNewDocumentCreation />
      </div>
      <div className="md:block hidden">
        {documentCreations?.length > 0 && (
          <HistoryHeader
            selectedChats={selectedDocumentCreations}
            handleMassDelete={handleMassDelete}
            setSelectedChats={setSelectedDocumentCreations}
            isMassDelete={isMassDelete}
            setIsMassDelete={setIsMassDelete}
            chatHistoryTranslations={documentCreationTranslations}
          />
        )}

        {documentCreations.map((documentCreation) => (
          <div
            className={cn(
              'py-3 hover:cursor-pointer px-2 flex flex-col justify-center items-center',
              {
                'border-r-2 border-primary bg-slate-200': path.endsWith(
                  documentCreation.id
                ),
                'bg-red-100 border-l-4 border-red-500':
                  isMassDelete &&
                  selectedDocumentCreations.includes(documentCreation.id),
              }
            )}
            key={documentCreation.id}
          >
            <div className="flex space-x-4 justify-between items-center w-full">
              {visibleNoteDocumentCreationId === documentCreation.id ? (
                <div className="w-full">
                  {renderNoteEditingContent(documentCreation)}
                </div>
              ) : isMassDelete ? (
                <div
                  className="w-full cursor-pointer"
                  onClick={() =>
                    handleDocumentCreationSelection(documentCreation.id)
                  }
                >
                  <div className="w-full">
                    {renderDocumentCreationContent(documentCreation)}
                  </div>
                </div>
              ) : (
                <Link
                  href={`/${locale}/document-creation/${documentCreation.id}`}
                  className="w-full"
                >
                  <div className="w-full">
                    {renderDocumentCreationContent(documentCreation)}
                  </div>
                </Link>
              )}

              {!isMassDelete && (
                <div className="flex items-center space-x-2">
                  {visibleNoteDocumentCreationId === documentCreation.id ? (
                    <TickCircle
                      size={15}
                      className="cursor-pointer"
                      onClick={() =>
                        handleSaveNote(
                          documentCreation.id,
                          notes[documentCreation.id] ||
                            documentCreation.note ||
                            ''
                        )
                      }
                    />
                  ) : (
                    <Note
                      size={15}
                      className="cursor-pointer"
                      onClick={() => toggleNoteVisibility(documentCreation.id)}
                    />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Trash
                        size={15}
                        variant="Broken"
                        className="cursor-pointer"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        className="text-xs"
                        onClick={() => {
                          toast.promise(
                            deleteDocumentCreation(documentCreation.id),
                            {
                              loading: `${documentCreationTranslations.deleteToastLoading}...`,
                              success:
                                documentCreationTranslations.deleteToastSuccess,
                              error: "Oops! Couldn't Delete, try again",
                            }
                          )
                        }}
                      >
                        {documentCreationTranslations.deleteConfirmation}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DocumentCreationLinks
