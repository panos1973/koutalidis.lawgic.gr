/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
} from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Markdown from 'markdown-to-jsx'
interface Reference {
  id: string
  pdf_url?: string | null
  pdf_page_url?: string | null
  file_url?: string | null
  source_url?: string | null
  court?: string | null
  decision_number?: string | null
  decision_date?: string | null
  case_type?: string | null
  main_laws?: string | null
  key_articles?: string | null
  primary_issue?: string | null
  full_text?: string | null
  generated_name?: string | null
  reference_type?: 'LAW' | 'COURT_DECISION' | 'LEGAL_ARTICLE' | 'OTHER' | null
  short_citation?: string | null
  chatId: string
  messageId: string
  createdAt?: Date
  ref_sequence?: string | null
}

interface ReferencesProps {
  chatId: string
  fetchReferencesFlag: boolean
  referencesLoading: boolean
  getReferences: any
  resetFetchFlag: any
  selectedReference: any
  onReferenceSelect: any
}

// Helper function to safely process text
const sanitizeText = (text: string): string => {
  if (!text || typeof text !== 'string') return ''
  return text.trim()
}

const formatFullText = (text: string): string => {
  // Safety check
  const safeText = sanitizeText(text)
  if (!safeText) return ''

  try {
    // Remove lines containing only hashtags
    let cleanedText = text.replace(/^\s*#{1,}\s*$/gm, '').trim()

    // // Remove section 6 onwards
    // const regex = /\#\#\s*6\.\s*RETRIEVAL OPTIMIZATION\b[\s\S]*?/i
    // cleanedText = cleanedText.replace(regex, '').trim()

    // Remove the CORE METADATA section
    const coreMetadataRegex =
      /\d+\.\s*(?:\*\*)?CORE METADATA\s*\[ΥΨΗΛΗ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ\](?:\*\*)?\s*(?:\n|.)*?(?=\d+\.\s*(?:\*\*)?ESSENTIAL LEGAL ELEMENTS)/i
    cleanedText = cleanedText.replace(coreMetadataRegex, '').trim()

    // Remove 'Σύνοψη Δικαστικής Υπόθεσης' text
    const summaryTextRegex = /Σύνοψη\s+Δικαστικής\s+Υπόθεσης\s*/g
    cleanedText = cleanedText.replace(summaryTextRegex, '').trim()

    // Remove all # symbols from the text
    cleanedText = cleanedText.replace(/#/g, '').trim()

    // Format headers while preserving priorities
    const headerRegexes = [
      {
        find: /\d+\.\s*ESSENTIAL LEGAL ELEMENTS\s*\[(\s*ΥΨΗΛΗ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ\s*)\]/g,
        replace: '<br/>',
      },
      {
        find: /Σύνοψη\s*Δικαστικής\s*Απόφασης/g,
        replace: '',
      },
      {
        find: /\d+\.\s*KEY FACTS & PROCEDURE\s*\[(\s*ΜΕΣΑΙΑ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ\s*)\]/g,
        replace: '<br/>',
      },
      {
        find: /\d+\.\s*COURT'S ANALYSIS\s*\[(\s*ΜΕΣΑΙΑ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ\s*)\]/g,
        replace: '<br/>',
      },
      {
        find: /\d+\.\s*OUTCOME\s*\[(\s*ΥΨΗΛΗ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ\s*)\]/g,
        replace: '<br/>',
      },
      {
        find: /\d+\.\s*ΥΨΗΛΗ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ/g,
        replace: '<br/>',
      },
      {
        find: /\d+\.\s*ΜΕΣΑΙΑ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ/g,
        replace: '<br/>',
      },
      {
        find: /6\.\s*RETRIEVAL OPTIMIZATION\s*\[(\s*ΥΨΗΛΗ\s*ΠΡΟΤΕΡΑΙΟΤΗΤΑ\s*)\]/g,
        replace: '<br/>',
      },
    ]

    // Apply formatting to each header
    headerRegexes.forEach(({ find, replace }) => {
      cleanedText = cleanedText.replace(find, replace)
    })

    return cleanedText
  } catch (error) {
    console.error('Error formatting text:', error)
    return sanitizeText(text) // Return sanitized but unformatted text as fallback
  }
}

export function References({
  chatId,
  getReferences,
  fetchReferencesFlag,
  referencesLoading,
  resetFetchFlag,
  selectedReference,
  onReferenceSelect,
}: ReferencesProps) {
  const [references, setReferences] = useState<Reference[]>([])
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set())
  const [selectedContent, setSelectedContent] = useState<{
    url?: string
    title: string
    content?: string
    isPdf: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (selectedReference && references.length > 0) {
      const refToOpen = references.find(
        (ref) => ref.ref_sequence === selectedReference
      )
      if (refToOpen) {
        openContent(refToOpen)
      }
    }
  }, [selectedReference, references])

  useEffect(() => {
    const fetchReferences = async () => {
      setIsLoading(true)
      try {
        const refs = await getReferences(chatId)
        setReferences(refs)
        resetFetchFlag()
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching references:', error)
      }
    }

    fetchReferences()
  }, [chatId, fetchReferencesFlag])

  // const toggleExpand = (refId: string) => {
  //   setExpandedRefs((prev) => {
  //     const newSet = new Set(prev)
  //     if (newSet.has(refId)) {
  //       newSet.delete(refId)
  //     } else {
  //       newSet.add(refId)
  //     }
  //     return newSet
  //   })
  // }

  const handlePdfLoad = () => {
    setIsLoading(false)
    setLoadError(false)
  }

  const handlePdfError = () => {
    setLoadError(true)
    setIsLoading(false)
  }

  const resetContentState = () => {
    setSelectedContent(null)
    setIsLoading(false)
    setLoadError(false)
  }

  const formatPdfUrl = (url: string) => {
    if (url.startsWith('http')) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(
        url
      )}&embedded=true`
    }
    return url
  }

  const getBestPdfUrl = (ref: Reference): string | null => {
    // Priority: pdf_page_url (has #page=N) > file_url (full PDF) > pdf_url (legacy)
    return ref.pdf_page_url || ref.file_url || ref.pdf_url || null
  }

  const openPdf = (ref: Reference) => {
    const pdfUrl = getBestPdfUrl(ref)
    if (pdfUrl) {
      // Open directly in new tab — Azure Blob PDFs render natively in browsers
      window.open(pdfUrl, '_blank')
    }
  }

  const openOfficialSource = (ref: Reference) => {
    if (ref.source_url) {
      window.open(ref.source_url, '_blank')
    }
  }

  const openContent = (ref: Reference) => {
    const pdfUrl = getBestPdfUrl(ref)
    if (pdfUrl) {
      setIsLoading(true)
      setLoadError(false)
      setSelectedContent({
        url: formatPdfUrl(pdfUrl),
        title:
          ref.generated_name ||
          `${ref.court} - ${ref.decision_number || 'Document'}`,
        isPdf: true,
      })
    } else if (ref.full_text) {
      setSelectedContent({
        title:
          ref.generated_name ||
          `${ref.court} - ${ref.decision_number || 'Document'}`,
        content: ref.full_text,
        isPdf: false,
      })
    }
  }

  // const getReferenceBadgeColor = (type: string) => {
  //   switch (type) {
  //     case 'LAW':
  //       return 'bg-blue-100 text-blue-800'
  //     case 'COURT_DECISION':
  //       return 'bg-purple-100 text-purple-800'
  //     case 'LEGAL_ARTICLE':
  //       return 'bg-green-100 text-green-800'
  //     default:
  //       return 'bg-gray-100 text-gray-800'
  //   }
  // }

  if (isLoading || referencesLoading) {
    return (
      <div className="flex justify-center items-center h-full py-8">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!references.length) {
    return (
      <div className="text-center text-sm text-gray-500 py-4">
        No references available
      </div>
    )
  }

  // Group references by messageId
  const groupedReferences = references.reduce((acc, ref) => {
    if (!acc[ref.messageId]) {
      acc[ref.messageId] = []
    }
    acc[ref.messageId].push(ref)
    return acc
  }, {} as Record<string, Reference[]>)

  return (
    <>
      <div className="h-full overflow-y-auto no-scrollbar">
        {Object.entries(groupedReferences)
          .sort((a, b) => {
            const aDate = new Date(a[1][0]?.createdAt || 0)
            const bDate = new Date(b[1][0]?.createdAt || 0)
            return bDate.getTime() - aDate.getTime() // Descending order
          })
          .map(([messageId, messageRefs], index) => (
            <div
              key={messageId}
              className="mb-8"
            >
              <div className="text-sm font-medium text-gray-500 my-2 px-2 border-b-2 border-gray-200">
                {Object.keys(groupedReferences).length === 1
                  ? 'Legal Documents for Query'
                  : `Legal Documents for Query ${
                      Object.keys(groupedReferences).length - index
                    }`}
              </div>

              {/* Group references by type */}
              {['LAW', 'COURT_DECISION', 'LEGAL_ARTICLE', 'OTHER'].map(
                (refType) => {
                  const refsOfType = messageRefs.filter(
                    (ref) => ref.reference_type === refType
                  )
                  if (refsOfType.length === 0) return null

                  return (
                    <div
                      key={refType}
                      className="mb-4"
                    >
                      <div className="text-xs font-semibold text-gray-600 mb-2 px-2 py-1 bg-gray-100 rounded-md">
                        {refType === 'LAW' && 'Law References'}
                        {refType === 'COURT_DECISION' &&
                          'Court Case References'}
                        {refType === 'LEGAL_ARTICLE' &&
                          'Legal Article References'}
                        {refType === 'OTHER' && 'Other References'}
                      </div>
                      <div className="space-y-4">
                        {refsOfType
                          .sort((a, b) => {
                            const aNum = parseInt(
                              a.ref_sequence?.replace('REF_', '') || '0'
                            )
                            const bNum = parseInt(
                              b.ref_sequence?.replace('REF_', '') || '0'
                            )
                            return aNum - bNum
                          })
                          .map((ref) => (
                            <div
                              key={ref.id}
                              className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                            >
                              {/* Header Section */}
                              <div className="py-4 px-2 flex justify-between items-start border-b bg-gray-50">
                                <div className="space-y-2 flex-grow">
                                  {/* Main Title - Generated Name */}
                                  <div className="flex items-start justify-between">
                                    <h3 className="font-medium text-sm text-gray-900">
                                      {/* {ref.ref_sequence
                                ? `[${ref.ref_sequence.replace('REF_', '')}] `
                                : ''} */}
                                      {ref.generated_name ||
                                        ref.court ||
                                        'Unnamed Reference'}
                                    </h3>
                                    {/* {ref.reference_type && (
                              <span
                                className={`text-xs px-2 py-1 rounded-full ml-2 ${getReferenceBadgeColor(
                                  ref.reference_type
                                )}`}
                              >
                                {ref.reference_type.replace('_', ' ')}
                              </span>
                            )} */}
                                  </div>

                                  {/* Metadata Row */}
                                  {/* <div className="text-xs text-gray-600 space-x-2">
                            {ref.court &&
                              ref.court.trim() !== '' &&
                              ref.court.trim() !== 'Δ/Υ' && (
                                <span>• No. {ref.court.trim()}</span>
                              )}
                            {ref.decision_number &&
                              ref.decision_number.trim() !== '' &&
                              ref.decision_number.trim() !== 'Δ/Υ' && (
                                <span>• No. {ref.decision_number.trim()}</span>
                              )}
                            {ref.decision_date &&
                              ref.decision_date.trim() !== '' &&
                              ref.decision_date.trim() !== 'Δ/Υ' && (
                                <span>• No. {ref.decision_date.trim()}</span>
                              )}
                          </div> */}

                                  {/* Citation */}
                                  {/* {ref.short_citation && (
                            <div className="text-xs text-gray-500 font-mono">
                              {ref.short_citation}
                            </div>
                          )} */}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-1 ml-4">
                                  {/* View PDF button — opens pdf_page_url or file_url directly */}
                                  {getBestPdfUrl(ref) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openPdf(ref)}
                                      className="p-1 h-7 hover:bg-blue-50 text-xs gap-1"
                                      title="View source PDF"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                        <line x1="10" y1="9" x2="8" y2="9"/>
                                      </svg>
                                      <span className="text-red-700 font-medium">PDF</span>
                                    </Button>
                                  )}
                                  {/* Official source link — opens ET.gr or other official source */}
                                  {ref.source_url && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openOfficialSource(ref)}
                                      className="p-1 h-7 hover:bg-green-50 text-xs gap-1"
                                      title="View official source (ET.gr)"
                                    >
                                      <ExternalLinkIcon className="h-3.5 w-3.5 text-green-700" />
                                      <span className="text-green-700 font-medium">ET.gr</span>
                                    </Button>
                                  )}
                                  {/* Fallback: view content in modal if no PDF available */}
                                  {!getBestPdfUrl(ref) && ref.full_text && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openContent(ref)}
                                      className="p-1 h-7 hover:bg-gray-200 text-xs gap-1"
                                      title="View content"
                                    >
                                      <ExternalLinkIcon className="h-3.5 w-3.5 text-blue-600" />
                                      <span className="text-blue-700 font-medium">View</span>
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Expanded Content */}
                              {/* {expandedRefs.has(ref.id) && (
                        <div className="p-4 space-y-4"> */}
                              {/* Summary Section */}
                              {/* {ref.full_text && (
                            <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                              <h4 className="font-medium text-xs text-gray-600 mb-2">
                                SUMMARY
                              </h4>
                              {ref.full_text}
                            </div>
                          )} */}

                              {/* Details Grid */}
                              {/* <div className="grid grid-cols-2 gap-4 text-xs">
                            {ref.case_type && (
                              <div>
                                <span className="font-medium text-gray-700">
                                  Case Type:{' '}
                                </span>
                                <span className="text-gray-600">{ref.case_type}</span>
                              </div>
                            )}
                            {ref.main_laws && (
                              <div>
                                <span className="font-medium text-gray-700">
                                  Laws:{' '}
                                </span>
                                <span className="text-gray-600">{ref.main_laws}</span>
                              </div>
                            )}
                            {ref.key_articles && (
                              <div>
                                <span className="font-medium text-gray-700">
                                  Articles:{' '}
                                </span>
                                <span className="text-gray-600">
                                  {ref.key_articles}
                                </span>
                              </div>
                            )}
                            {ref.primary_issue && (
                              <div className="col-span-2">
                                <span className="font-medium text-gray-700">
                                  Primary Issue:{' '}
                                </span>
                                <span className="text-gray-600">
                                  {ref.primary_issue}
                                </span>
                              </div>
                            )}
                          </div> */}
                              {/* </div>
                      )} */}
                            </div>
                          ))}
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          ))}
      </div>

      {/* PDF Viewer Dialog */}
      <Dialog
        open={!!selectedContent}
        onOpenChange={(open) => {
          if (!open) {
            resetContentState()
          }
        }}
      >
        <DialogContent className="max-w-[80svw] max-h-[90svh] w-fit h-fit overflow-hidden p-4 flex flex-col">
          <DialogHeader className="max-h-[10svh] h-fit flex-shrink-0 mr-10">
            <DialogTitle>{selectedContent?.title}</DialogTitle>
            <DialogDescription>Νομικό Έγγραφο</DialogDescription>
          </DialogHeader>
          {selectedContent && (
            <div className="relative flex-grow">
              {selectedContent.isPdf ? (
                <>
                  {isLoading && !loadError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}
                  {loadError ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <p className="text-red-600">
                        Could not load the document
                      </p>
                      <button
                        onClick={() => {
                          setIsLoading(true)
                          setLoadError(false)
                          if (selectedContent.url) {
                            setSelectedContent({
                              ...selectedContent,
                              url: formatPdfUrl(selectedContent.url),
                            })
                          }
                        }}
                        className="px-4 py-2 text-sm text-white bg-[#c2032f] rounded hover:bg-[#a30228]"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <object
                      data={selectedContent.url}
                      type="application/pdf"
                      className="min-w-[75svw] min-h-[90svh] flex-grow"
                      onLoad={handlePdfLoad}
                      onError={handlePdfError}
                    >
                      <p>Unable to display PDF file.</p>
                    </object>
                  )}
                </>
              ) : (
                <div className="overflow-y-auto max-h-[70vh] p-6 bg-white rounded-lg prose prose-sm max-w-none">
                  {selectedContent.content && (
                    <Markdown
                      options={{
                        overrides: {
                          h3: {
                            props: {
                              className: 'text-lg font-semibold mt-6 mb-4',
                            },
                          },
                          p: {
                            props: {
                              className: 'my-2 text-gray-700',
                            },
                          },
                        },
                      }}
                    >
                      {formatFullText(selectedContent.content)}
                    </Markdown>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
