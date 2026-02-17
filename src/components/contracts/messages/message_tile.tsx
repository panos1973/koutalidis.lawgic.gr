/* eslint-disable @next/next/no-img-element */
import { Message } from 'ai'
import { NextPage } from 'next'
import Markdown from 'markdown-to-jsx'
import { cn, relativeTimeFromDates } from '@/lib/utils'
import CopyMessage from '@/components/misc/copy_message'
import ExportMessage from '@/components/misc/export_message'
import { useState } from 'react'
import { Like1, Dislike } from 'iconsax-react'

interface Props {
  message: Message
  isGenerating: boolean
  runId: string | null
  append?: (message: { content: string; role: 'user' | 'assistant' }) => void
  scrollToBottom?: () => void
}

const MessageTile: NextPage<Props> = ({
  message: m,
  isGenerating,
  runId,
  append,
  scrollToBottom,
}) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const sendFeedback = async (newFeedback: 'up' | 'down') => {
    // Toggle feedback
    const updatedFeedback = feedback === newFeedback ? null : newFeedback
    setFeedback(updatedFeedback)
    const feedbackString = updatedFeedback === null ? 'none' : updatedFeedback

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
        feedback: feedbackString,
        feedback_key: 'chat',
      }),
    })
  }

  const handleQuestionClick = (question: string) => {
    if (!append || !scrollToBottom) return

    const cleanedQuestion = question
      .replace(/^\d+\.\s*/, '')
      .replace(/\(#\)/g, '')
      .replace(/;?\(#\)/g, '')

    append({
      content: cleanedQuestion,
      role: 'user',
    })
    scrollToBottom()
  }

  const renderContentWithQuestions = (content: string) => {
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return (
        <div className="text-gray-500 italic">
          {isGenerating && m.role === 'assistant'
            ? 'Processing your response...'
            : 'Response was not available'}
        </div>
      )
    }

    // Question patterns matching the chat message tile approach
    const questionPatterns = [
      {
        pattern:
          /(?:^|\n)\s*(?:#{1,6}\s*)?(?:ΠΡΟΤΕΙΝΟΜΕΝΕΣ\s+ΕΡΩΤΗΣΕΙΣ|Προτεινόμενες\s+Ερωτήσεις|ΧΡΗΣΙΜΕΣ\s+ΕΡΩΤΗΣΕΙΣ|Suggested\s+Questions|Useful\s+Questions|Potential\s+Useful\s+Questions|Πιθανές\s+Χρήσιμες\s+Ερωτήσεις)\s*:?\s*(?:\n|$)/i,
        isGreek: true,
      },
    ]

    let questionsSection: string[] = []
    let mainContent = content
    let isGreek = false
    let hasQuestions = false

    // Find questions section at the end
    const contentLength = content.length
    const searchStart = Math.max(0, Math.floor(contentLength * 0.5))
    const searchArea = content.substring(searchStart)

    for (const { pattern, isGreek: patternIsGreek } of questionPatterns) {
      const matches = [...searchArea.matchAll(new RegExp(pattern.source, 'gi'))]

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]
        const matchIndex = lastMatch.index

        if (matchIndex !== undefined) {
          const actualPosition = searchStart + matchIndex
          const questionsText = content.substring(
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

            mainContent = content.substring(0, actualPosition).trim()

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

    return (
      <>
        <div className="prose prose-sm max-w-none">
          <Markdown
            options={{
              overrides: {
                h1: {
                  props: {
                    className: 'text-xl font-bold mb-2 mt-4',
                  },
                },
                h2: {
                  props: {
                    className: 'text-lg font-bold mb-2 mt-3',
                  },
                },
                h3: {
                  props: {
                    className: 'text-base font-bold mb-1 mt-2',
                  },
                },
                p: {
                  props: {
                    className: 'mb-2 leading-relaxed',
                  },
                },
                ul: {
                  props: {
                    className: 'list-disc list-inside mb-2 space-y-1',
                  },
                },
                ol: {
                  props: {
                    className: 'list-decimal list-inside mb-2 space-y-1',
                  },
                },
                li: {
                  props: {
                    className: 'leading-relaxed',
                  },
                },
                code: {
                  props: {
                    className:
                      'bg-gray-100 px-1 py-0.5 rounded text-sm font-mono',
                  },
                },
                pre: {
                  props: {
                    className:
                      'bg-gray-100 p-3 rounded-md overflow-x-auto mb-2',
                  },
                },
                blockquote: {
                  props: {
                    className: 'border-l-4 border-gray-300 pl-4 italic mb-2',
                  },
                },
                strong: {
                  props: {
                    className: 'font-bold',
                  },
                },
                em: {
                  props: {
                    className: 'italic',
                  },
                },
                a: {
                  props: {
                    className: 'text-blue-600 hover:text-blue-800 underline',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                },
                table: {
                  props: {
                    className: 'border-collapse border border-gray-300 mb-2',
                  },
                },
                th: {
                  props: {
                    className:
                      'border border-gray-300 px-2 py-1 bg-gray-100 font-bold',
                  },
                },
                td: {
                  props: {
                    className: 'border border-gray-300 px-2 py-1',
                  },
                },
              },
            }}
          >
            {mainContent}
          </Markdown>
        </div>

        {/* Questions section with same styling as chat message tile */}
        {questionsSection.length > 0 && append && (
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
    <div
      className={cn('text-sm mb-6 py-2 px-4 rounded-3xl', {
        'whitespace-pre-wrap self-end bg-slate-200  max-w-fit md:max-w-[40svw] rounded-br-none overflow-clip':
          m.role === 'user',
        'border border-slate-200 max-w-fit rounded-bl-none py-6':
          m.role === 'assistant',
      })}
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
          {renderContentWithQuestions(m.content)}
        </div>
      </div>

      {m.role === 'assistant' && !isGenerating && (
        <div className="flex items-center space-x-2 justify-end mt-4">
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
  )
}

export default MessageTile
