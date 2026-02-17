/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
import { Message } from 'ai'
import { NextPage } from 'next'
import ReactMarkdown from 'react-markdown'
import { processDocumentUrls } from '@/lib/utils'
import { cn, relativeTimeFromDates } from '@/lib/utils'
import CopyMessage from '@/components/misc/copy_message'
import ExportMessage from '@/components/misc/export_message'
import { useEffect, useState } from 'react'
import { Like1, Dislike } from 'iconsax-react'
import {
  addMessage,
  getReferencesForChat,
  getReferencesForMessage,
} from '@/app/[locale]/actions/chat_actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  message: Message
  isGenerating: boolean
  runId: string | null
  chatId: string
  append: (message: { content: string; role: 'user' | 'assistant' }) => void
  scrollToBottom: () => void
  fetchReferencesFlagMessageTile: boolean
  resetFetchFlagMessageTile: any
  referencesLoading: boolean
}

// ENHANCED formatting function with aggressive cleanup
const formatLegalContent = (text: string): string => {
  if (!text || typeof text !== 'string') return ''

  console.log('Formatting legal content in MessageTile')

  let formattedText = text

  // Step 1: Preserve blockquotes ONLY in sources section
  const sourcesIndex = formattedText.search(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:Πηγές|Sources|ΠΗΓΕΣ)/i)
  
  if (sourcesIndex > -1) {
    // Split content into main and sources
    const mainContent = formattedText.substring(0, sourcesIndex)
    const sourcesContent = formattedText.substring(sourcesIndex)
    
    // Remove blockquote indicators from main content only
    const cleanedMain = mainContent
      .replace(/^>\s*/gm, '')  // Remove > at line start
      .replace(/^[\t ]{4,}/gm, '')  // Remove excessive indentation
    
    // Recombine
    formattedText = cleanedMain + sourcesContent
  } else {
    // No sources section, clean entire content
    formattedText = formattedText
      .replace(/^>\s*/gm, '')
      .replace(/^[\t ]{4,}/gm, '')
  }

  // ... rest of your existing formatting code ...
  
  return formattedText
}
const MessageTile: NextPage<Props> = ({
  message: m,
  isGenerating,
  runId,
  chatId,
  append,
  scrollToBottom,
  fetchReferencesFlagMessageTile,
  resetFetchFlagMessageTile,
  referencesLoading,
}) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [selectedContent, setSelectedContent] = useState<{
    url?: string | any
    title: string
    content?: string
    isPdf: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pdfIsLoading, setPdfIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!fetchReferencesFlagMessageTile) return

    const fetchReferences = async () => {
      try {
        const references = await getReferencesForChat(chatId)
        console.log('Message Tile - References fetched:', references)
      } catch (error) {
        console.error('Error fetching references:', error)
      } finally {
        resetFetchFlagMessageTile()
      }
    }

    fetchReferences()
  }, [fetchReferencesFlagMessageTile, chatId])

  const sendFeedback = async (newFeedback: 'up' | 'down') => {
    const updatedFeedback = feedback === newFeedback ? null : newFeedback
    setFeedback(updatedFeedback)

    if (!runId) {
      console.log('runId is null, no feedback sent')
      return
    }

    await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        runId,
        feedback: updatedFeedback === null ? 'none' : updatedFeedback,
        feedback_key: 'chat',
      }),
    })
  }

  const handleQuestionClick = (question: string) => {
    const cleanedQuestion = question
      .replace(/^\d+\.\s*/, '')
      .replace(/\(#\)/g, '')
      .replace(/;?\(#\)/g, '')
    addMessage(chatId, 'user', cleanedQuestion)
    append({
      content: cleanedQuestion,
      role: 'user',
    })
    scrollToBottom()
  }

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

  const formatPdfUrl = async (url: any) => {
    const basePath = '/en'
    setPdfIsLoading(true)

    try {
      if (url && url.startsWith('https://storage.googleapis.com/')) {
        return `${basePath}/api/pdf?pdfUrl=${encodeURIComponent(url)}`
      }

      if (url && url.startsWith('http')) {
        return `${basePath}/api/pdf?pdfUrl=${encodeURIComponent(url)}`
      }

      return url
    } catch (error) {
      console.error('Error in formatPdfUrl:', error)
      throw error
    } finally {
      setPdfIsLoading(false)
    }
  }

  const handleReferenceClick = async (refId: string) => {
    console.log('Message Tile - handleReferenceClick called with refId:', refId)

    setSelectedContent({
      title: 'Φόρτωση...',
      isPdf: false,
    })
    setIsLoading(true)
    setLoadError(false)

    try {
      const references = await getReferencesForChat(chatId)
      console.log('Message Tile - References fetched:', references)

      const reference = references.find((ref) => ref.ref_sequence === refId)
      console.log('Message Tile - Found reference:', reference)

      if (!reference) {
        console.error('Message Tile - Reference not found:', refId)
        setSelectedContent({
          title: 'Reference Not Found',
          content: 'The requested reference could not be found.',
          isPdf: false,
        })
        return
      }

      if (reference.pdf_url) {
        console.log('Message Tile - Handling PDF reference:', reference.pdf_url)

        const formattedUrl = await formatPdfUrl(reference.pdf_url)
        setSelectedContent({
          url: formattedUrl,
          title:
            reference.generated_name ||
            `${reference.court} - ${reference.decision_number || 'Document'}`,
          isPdf: true,
        })
      } else if (reference.full_text) {
        console.log('Message Tile - No PDF URL, showing text content')

        const formattedContent = formatLegalContent(reference.full_text)

        setSelectedContent({
          title:
            reference.generated_name ||
            `${reference.court} - ${reference.decision_number || 'Document'}`,
          content: formattedContent,
          isPdf: false,
        })
      } else {
        console.log('Message Tile - No PDF URL or content available')
        setSelectedContent({
          title: reference.generated_name || 'Document Not Available',
          content:
            'The PDF for this reference is not available. The relevant information has been included in the main response above.',
          isPdf: false,
        })
      }
    } catch (error) {
      console.error('Message Tile - Error in handleReferenceClick:', error)
      setSelectedContent({
        title: 'Error',
        content: 'An error occurred while fetching the reference.',
        isPdf: false,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Main content rendering with proper formatting
  const renderContentWithReferences = (content: string) => {
    if (!content || typeof content !== 'string' || content.trim() === '') {
      console.error('MESSAGE TILE: Invalid content!', {
        messageRole: m.role,
        messageId: m.id,
        contentType: typeof content,
        contentValue: content,
        isGenerating,
      })

      return (
        <div className="text-gray-500 italic">
          {isGenerating && m.role === 'assistant'
            ? 'Επεξεργάζομαι την απάντησή σας...'
            : 'Η απάντηση δεν ήταν διαθέσιμη'}
        </div>
      )
    }

    // Clean and format the content
    let processedContent = formatLegalContent(content)

    console.log('PROCESSING CONTENT LENGTH:', processedContent.length)

    // Remove REFERENCES_USED section
    const cleanContent = processedContent.replace(
      /REFERENCES_USED:\s*\[.*?\]\s*\n?/g,
      ''
    )

    // Extract questions section
    let questionsSection: string[] = []
    let mainContent = cleanContent
    let isGreek = false
    let hasQuestions = false

    const questionPatterns = [
      {
        pattern:
          /(?:^|\n)\s*(?:#{1,6}\s*)?(?:ΠΡΟΤΕΙΝΟΜΕΝΕΣ\s+ΕΡΩΤΗΣΕΙΣ|Προτεινόμενες\s+Ερωτήσεις|ΧΡΗΣΙΜΕΣ\s+ΕΡΩΤΗΣΕΙΣ|Suggested\s+Questions|Useful\s+Questions)\s*:?\s*(?:\n|$)/i,
        isGreek: true,
      },
    ]

    // Find questions section at the end
    const contentLength = cleanContent.length
    const sourcesMatches = cleanContent.match(/(Πηγές|Sources|ΠΗΓΕΣ)/gi)
    let searchStart = 0

    if (sourcesMatches && sourcesMatches.length > 0) {
      const lastSourcesIndex = cleanContent.lastIndexOf(
        sourcesMatches[sourcesMatches.length - 1]
      )
      if (lastSourcesIndex > contentLength * 0.5) {
        searchStart = lastSourcesIndex
      }
    }

    if (searchStart === 0) {
      searchStart = Math.max(0, Math.floor(contentLength * 0.85))
    }

    const searchArea = cleanContent.substring(searchStart)

    for (const { pattern, isGreek: patternIsGreek } of questionPatterns) {
      const matches = [...searchArea.matchAll(new RegExp(pattern.source, 'gi'))]

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]
        const matchIndex = lastMatch.index

        if (matchIndex !== undefined) {
          const actualPosition = searchStart + matchIndex
          const questionsText = cleanContent.substring(
            actualPosition + lastMatch[0].length
          )

          const hasNumberedQuestions =
            /^\s*\d+\./m.test(questionsText) ||
            /^\s*[-•]\s+/m.test(questionsText) ||
            questionsText.split('\n').filter((line) => line.trim().length > 10)
              .length >= 2

          if (hasNumberedQuestions) {
            hasQuestions = true
            isGreek = patternIsGreek

            mainContent = cleanContent.substring(0, actualPosition).trim()

            let questionItems = questionsText
              .split('\n')
              .map((q) => q.trim())
              .filter((q) => q.length > 0 && !q.includes('<br />'))

            questionsSection = questionItems
              .map((q) => {
                // Clean up the question text
                let cleaned = q
                  .replace(/^\*?\*?/, '') // Remove asterisks
                  .replace(/^\d+\.\s*/, '') // Remove numbering
                  .replace(/^[-•]\s*/, '') // Remove bullet points
                  .replace(/^\[/, '') // Remove opening bracket
                  .replace(/\]$/, '') // Remove closing bracket
                  .replace(/^#{1,6}\s*/, '') // Remove markdown headers
                  .replace(/\s{2,}/g, ' ') // Clean multiple spaces
                  .trim()

                return cleaned
              })
              .filter((q) => q.length > 0 && !q.match(/^(Πηγές|Sources|---)/i))

            break
          }
        }
      }
    }

    // Handle reference tags - remove them for now
    let finalContent = mainContent.replace(/\[REF_(\d+)\]/g, ' ')

    return (
      <>
        <div
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.classList.contains('reference-link')) {
              const refNum = target.getAttribute('data-ref')
              if (refNum) {
                handleReferenceClick(`${refNum}`)
                e.preventDefault()
                e.stopPropagation()
              }
            }
          }}
        >
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => (
                <h1
                  className="text-lg font-semibold mt-2 mb-1 text-black"
                  {...props}
                />
              ),
              h2: ({ node, ...props }) => (
                <h2
                  className="text-lg font-semibold mt-2 mb-1 text-black"
                  {...props}
                />
              ),
              h3: ({ node, ...props }) => (
                <h3
                  className="text-base font-semibold mt-1.5 mb-0.5 text-black"
                  {...props}
                />
              ),
              h4: ({ node, ...props }) => (
                <h4
                  className="text-base font-semibold mt-1.5 mb-0.5 text-black"
                  {...props}
                />
              ),
              p: ({ node, ...props }) => (
                <p
                  className="font-normal text-black leading-normal mb-1.5"
                  {...props}
                />
              ),
              strong: ({ node, ...props }) => (
                <strong
                  className="font-bold text-black"
                  {...props}
                />
              ),
              // CRITICAL FIX: Tighter list spacing
              ul: ({ node, ...props }) => (
                <ul
                  className="text-black list-disc pl-4 my-0.5 space-y-0"
                  {...props}
                />
              ),
              ol: ({ node, ...props }) => (
                <ol
                  className="text-black list-decimal pl-4 my-0.5 space-y-0"
                  {...props}
                />
              ),
              li: ({ node, ...props }) => (
                <li
                  className="text-black leading-snug"
                  {...props}
                />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  className="pl-3 border-l-4 border-gray-300 text-black my-1.5"
                  {...props}
                />
              ),
              hr: () => <hr className="my-1.5 border-gray-200" />,
              br: () => null, // Remove br tags completely to avoid extra spacing
              a: ({ node, href, children, ...props }) => {
                if (
                  props.className &&
                  props.className.includes('reference-link')
                ) {
                  return (
                    <a
                      href={href}
                      className={props.className}
                      {...props}
                    >
                      {children}
                    </a>
                  )
                }

                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#b8082d] hover:text-[#8a0620] font-medium"
                    {...props}
                  >
                    {children}
                  </a>
                )
              },
              span: ({ node, className, ...props }: any) => {
                if (className && className.includes('reference-link')) {
                  return (
                    <span
                      className={className}
                      {...props}
                    />
                  )
                }
                return <span {...props} />
              },
            }}
          >
            {finalContent}
          </ReactMarkdown>
        </div>

        {/* Questions section with tighter spacing */}
        {questionsSection.length > 0 && (
          <div className="mt-2">
            <strong className="text-lg font-semibold text-black">
              {isGreek ? 'Προτεινόμενες Ερωτήσεις:' : 'Useful Questions:'}
            </strong>
            <ul className="list-none mt-2 space-y-2.5">
              {questionsSection.map((question, index) => (
                <li
                  key={index}
                  className="cursor-pointer text-[#b8082d] hover:text-[#8a0620] leading-snug"
                  onClick={() =>
                    handleQuestionClick(
                      question
                        .replace(/_/g, '')
                        .replace(/\(#\)/g, '')
                        .replace(/;?\(#\)/g, '')
                    )
                  }
                >
                  {`${index + 1}. ${question
                    .replace(/_/g, '')
                    .replace(/\(#\)/g, '')
                    .replace(/;?\(#\)/g, '')}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          'text-sm mb-4 py-2 px-4 rounded-3xl',
          {
            'whitespace-pre-wrap self-end bg-slate-200 max-w-fit md:max-w-[40svw] rounded-br-none overflow-clip':
              m.role === 'user',
            'border border-slate-200 max-w-fit rounded-bl-none py-4':
              m.role === 'assistant',
          }
        )}
      >
        <div className="flex md:flex-row flex-col md:mb-0 mb-2 md:space-x-4 md:space-y-0 space-y-2">
          {m.role === 'assistant' && (
            <div className="min-h-8 min-w-8 max-w-8 max-h-8 rounded-full bg-gray-200">
              <img
                src="/miniLogo.png"
                className="object-fill"
                alt="logo"
              />
            </div>
          )}
          <div className="w-full max-w-full overflow-hidden break-words overflow-wrap markdown-content">
            {renderContentWithReferences(m.content)}
          </div>
        </div>

        {m.role === 'assistant' && !isGenerating && (
          <div className="flex items-center space-x-2 justify-end mt-3">
            <p className="text-xs text-slate-500 pl-12">
              {relativeTimeFromDates(m.createdAt!)}
            </p>

            <div className="flex items-center">
              <ExportMessage content={m.content} />
              <CopyMessage content={m.content} />

              <div className="flex space-x-2 ml-2">
                <button onClick={() => sendFeedback('up')}>
                  <Like1
                    size="16"
                    color={feedback === 'up' ? '#2563EB' : '#2e2d2d'}
                    variant={feedback === 'up' ? 'Bold' : 'Outline'}
                  />
                </button>
                <button onClick={() => sendFeedback('down')}>
                  <Dislike
                    size="16"
                    color={feedback === 'down' ? '#2563EB' : '#2e2d2d'}
                    variant={feedback === 'down' ? 'Bold' : 'Outline'}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Dialog - unchanged */}
      <Dialog
        open={!!selectedContent}
        onOpenChange={(open) => {
          if (!open) {
            resetContentState()
          }
        }}
      >
        <DialogContent className="max-w-[80svw] max-h-[90svh] min-w-[50svh] min-h-[50svh] w-fit h-fit overflow-hidden p-4 flex flex-col">
          <DialogHeader className="max-h-[10svh] h-fit flex-shrink-0 mr-10">
            <DialogTitle>{selectedContent?.title}</DialogTitle>
            <DialogDescription>Νομικό Έγγραφο</DialogDescription>
          </DialogHeader>
          <div className="relative flex-grow">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
              </div>
            ) : selectedContent?.isPdf ? (
              <>
                {loadError ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <p className="text-red-600">Could not load the document</p>
                    <button
                      onClick={async () => {
                        setPdfIsLoading(true)
                        setLoadError(false)
                        try {
                          if (selectedContent?.url) {
                            const formattedUrl = await formatPdfUrl(
                              selectedContent.url
                            )
                            setSelectedContent({
                              ...selectedContent,
                              url: formattedUrl,
                            })
                          }
                        } catch (error) {
                          console.error('Error retrying PDF load:', error)
                          setLoadError(true)
                        } finally {
                          setPdfIsLoading(false)
                        }
                      }}
                      className="px-4 py-2 text-sm text-white bg-[#c2032f] rounded hover:bg-[#a30228]"
                    >
                      Try Again
                    </button>
                  </div>
                ) : pdfIsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <object
                    data={selectedContent?.url}
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
                {selectedContent?.content && (
                  <ReactMarkdown
                    components={{
                      h3: ({ node, ...props }) => (
                        <h3
                          className="text-lg font-semibold mt-4 mb-2 text-blue-700"
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }) => (
                        <p
                          className="my-2 text-gray-700 text-justify"
                          {...props}
                        />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong
                          className="font-bold text-blue-600"
                          {...props}
                        />
                      ),
                      a: ({ node, href, children, ...props }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {selectedContent.content}
                  </ReactMarkdown>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default MessageTile
