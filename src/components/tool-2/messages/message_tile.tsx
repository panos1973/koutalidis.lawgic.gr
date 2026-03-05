/* eslint-disable @next/next/no-img-element */
import { Message } from 'ai'
import { NextPage } from 'next'
import Markdown from 'markdown-to-jsx'
import { cn, relativeTimeFromDates } from '@/lib/utils'
import CopyMessage from '@/components/misc/copy_message'
import ExportMessage from '@/components/misc/export_message'
import { saveToolMessage } from '@/app/[locale]/actions/tool_2_actions'
import { useLocale } from 'next-intl'

interface Props {
  message: Message
  isGenerating: boolean
  tool2Id: string | any
  append: (message: { content: string; role: 'user' | 'assistant' }) => void
  onOpenFile: (filename: string, searchText: string) => void
  scrollToBottom: () => void
}

const MessageTile: NextPage<Props> = ({
  message: m,
  isGenerating,
  append,
  tool2Id,
  onOpenFile,
  scrollToBottom,
}) => {
  const locale = useLocale()
  // const handleOpenFile = () => {
  //   const filename = 'DPA Template 1 English.docx'
  //   const searchText =
  //     '2.2. This Data Processing Agreement constitutes an integral and inseparable part of the Service Agreement. In case of conflict, the terms of this Data Processing Agreement shall prevail over those of the Service Agreement.'
  //   onOpenFile(filename, searchText)
  // }
  const handleQuestionClick = (question: string) => {
    // Remove any numbering (e.g., "1.", "2.", etc.)
    const cleanedQuestion = question.replace(/^\d+\.\s*/, '')
    saveToolMessage(tool2Id, 'user', cleanedQuestion)
    append({
      content: cleanedQuestion,
      role: 'user',
    })
    scrollToBottom()
  }

  const renderContentWithQuestions = (content: string) => {
    const referencesEnglishPattern =
      /\b(?:<b>|[*]{2})?\s*References\s*(?:<\/b>|[*]{2})?:?\s*\n?/i

    const referencesGreekPattern =
      /(?:<b>|[*]{2})\s*Παραπομπές\s*(?:<\/b>|[*]{2})?:?\s*\n?/i

    // Updated question patterns to match the chat message tile approach
    const questionPatterns = [
      {
        pattern:
          /(?:^|\n)\s*(?:#{1,6}\s*)?(?:ΠΡΟΤΕΙΝΟΜΕΝΕΣ\s+ΕΡΩΤΗΣΕΙΣ|Προτεινόμενες\s+Ερωτήσεις|ΧΡΗΣΙΜΕΣ\s+ΕΡΩΤΗΣΕΙΣ|Suggested\s+Questions|Useful\s+Questions|Potential\s+Useful\s+Questions|Πιθανές\s+Χρήσιμες\s+Ερωτήσεις)\s*:?\s*(?:\n|$)/i,
        isGreek: true,
      },
    ]

    const referenceMap = new Map()
    console.log('Initial content:', content) // Log initial content

    // Extract and process References section (English)
    const englishReferencesMatch = content.match(referencesEnglishPattern)
    console.log('English references match:', englishReferencesMatch) // Log English references match result

    if (englishReferencesMatch) {
      const referencesContent = content
        .split(referencesEnglishPattern)[1]
        ?.trim()
      console.log('English references content (raw):', referencesContent) // Log extracted English references content

      if (referencesContent) {
        referencesContent
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .forEach((line) => {
            console.log('Processing line (English):', line) // Log each line being processed
            const refMatch = line.match(/^\[(\d+)\]/)
            if (refMatch) {
              const refNumber = `[${refMatch[1]}]`
              const remainingText = line.replace(/^\[\d+\]\s*/, '')
              const [text, filename] = remainingText.split(' - ')
              if (text && filename) {
                referenceMap.set(refNumber, {
                  filename: filename.trim(),
                  searchText: text.trim(),
                })
                console.log('Added to referenceMap (English):', refNumber, {
                  filename: filename.trim(),
                  searchText: text.trim(),
                }) // Log the map entry
              }
            }
          })
        // Remove English references from content for clean rendering
        // content = content.split(referencesEnglishPattern)[0].trim()
        console.log('Content after removing English references:', content) // Log content after English references are removed
      }
    }

    // Extract and process References section (Greek)
    const greekReferencesMatch = content.match(referencesGreekPattern)
    console.log('Greek references match:', greekReferencesMatch) // Log Greek references match result

    if (greekReferencesMatch) {
      const referencesContent = content.split(referencesGreekPattern)[1]?.trim()
      console.log('Greek references content (raw):', referencesContent) // Log extracted Greek references content

      if (referencesContent) {
        referencesContent
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .forEach((line) => {
            console.log('Processing line (Greek):', line) // Log each line being processed
            const refMatch = line.match(/^\[(\d+)\]/)
            if (refMatch) {
              const refNumber = `[${refMatch[1]}]`
              const remainingText = line.replace(/^\[\d+\]\s*/, '')
              const [text, filename] = remainingText.split(' - ')
              if (text && filename) {
                referenceMap.set(refNumber, {
                  filename: filename.trim(),
                  searchText: text.trim(),
                })
                console.log('Added to referenceMap (Greek):', refNumber, {
                  filename: filename.trim(),
                  searchText: text.trim(),
                }) // Log the map entry
              }
            }
          })
        // Remove Greek references from content for clean rendering
        // content = content.split(referencesGreekPattern)[0].trim()
        console.log('Content after removing Greek references:', content) // Log content after Greek references are removed
      }
    }

    // Apply references to transformed content
    let transformedContent = content.replace(/\[\s*(\d+)\s*\]/g, (match) => {
      const refKey = `[${match.match(/\d+/)?.[0]}]`
      console.log('Checking refKey:', refKey) // Log the refKey being checked
      if (referenceMap.has(refKey)) {
        console.log('Reference found in map:', refKey) // Log when a reference is found
        return `<a data-ref="${refKey}" class="reference-link">${refKey}</a>`
      }
      console.log('Reference not found in map:', refKey) // Log when a reference is not found
      return match
    })

    // // Append the "References" section if it exists
    // if (referenceMap.size > 0) {
    //   let referencesSection = `**References**:\n\n` // Bold the heading using markdown
    //   referenceMap.forEach((value, key) => {
    //     referencesSection += `${key} ${value.searchText} - ${value.filename}\n`
    //   })
    //   transformedContent += `\n\n${referencesSection}` // Add the references section at the end
    // }

    // Extract and handle questions section using the new flexible patterns
    let questionsSection: string[] = []
    let isGreek = false
    let hasQuestions = false

    // Find questions section at the end (similar to chat message tile approach)
    const contentLength = transformedContent.length
    const searchStart = Math.max(0, Math.floor(contentLength * 0.5)) // Search from middle onwards
    const searchArea = transformedContent.substring(searchStart)

    for (const { pattern, isGreek: patternIsGreek } of questionPatterns) {
      const matches = [...searchArea.matchAll(new RegExp(pattern.source, 'gi'))]

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]
        const matchIndex = lastMatch.index

        if (matchIndex !== undefined) {
          const actualPosition = searchStart + matchIndex
          const questionsText = transformedContent.substring(
            actualPosition + lastMatch[0].length
          )

          const hasNumberedQuestions =
            /^\s*-\s+/m.test(questionsText) || // bullet points with dashes
            /^\s*[-•]\s+/m.test(questionsText) ||
            questionsText.split('\n').filter((line) => line.trim().length > 10)
              .length >= 2

          if (hasNumberedQuestions) {
            hasQuestions = true
            isGreek = patternIsGreek

            transformedContent = transformedContent
              .substring(0, actualPosition)
              .trim()

            let questionItems = questionsText
              .split('\n')
              .map((q) => q.trim())
              .filter((q) => q.length > 0)

            questionsSection = questionItems
              .map((q) => {
                // Clean up the question text
                let cleaned = q
                  .replace(/^\*?\*?/, '') // Remove asterisks
                  .replace(/^\d+\.\s*/, '') // Remove numbering
                  .replace(/^[-•]\s*/, '') // Remove bullet points
                  .replace(/^#{1,6}\s*/, '') // Remove markdown headers
                  .replace(/\s{2,}/g, ' ') // Clean multiple spaces
                  .trim()

                return cleaned
              })
              .filter((q) => q.length > 0)

            break
          }
        }
      }
    }

    console.log('Questions section match:', hasQuestions)
    console.log('Questions found:', questionsSection)

    return (
      <>
        <Markdown
          options={{
            overrides: {
              a: {
                component: (props) => {
                  const ref = props['data-ref']
                  const refData = referenceMap.get(ref)
                  if (refData) {
                    console.log('Rendering clickable reference:', ref) // Log rendering of clickable reference
                    return (
                      <span
                        className="text-blue-500 cursor-pointer"
                        onClick={() =>
                          handleReferenceClick(
                            refData.filename,
                            refData.searchText
                          )
                        }
                      >
                        {ref}
                      </span>
                    )
                  }
                  return <span>{props.children}</span>
                },
              },
            },
          }}
        >
          {transformedContent}
        </Markdown>

        {/* Display Potential Useful Questions Section */}
        {questionsSection.length > 0 && (
          <div className="mt-4">
            <strong className="text-lg font-semibold text-black">
              {isGreek
                ? 'Προτεινόμενες Ερωτήσεις:'
                : 'Possible Useful Questions:'}
            </strong>
            <ul className="list-none mt-2 space-y-2.5">
              {questionsSection.map((question, index) => (
                <li
                  key={index}
                  className="cursor-pointer text-[#b8082d] hover:text-[#8a0620] leading-snug"
                  onClick={() => handleQuestionClick(question)}
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

  const handleReferenceClick = (filename: string, searchText: string) => {
    const cleanedText = searchText
      .replace(/^\[\d+\]\s*/, '')
      .replace(/^"(.*)"$/, '$1')

    console.log('Reference Text:', cleanedText)
    onOpenFile(filename, cleanedText)
  }

  return (
    <div
      className={cn('font-sans text-sm mb-6 py-2 px-4 rounded-3xl ', {
        'whitespace-pre-wrap self-end bg-slate-200  max-w-fit  md:max-w-[40svw] rounded-br-none text-right':
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
        <div>{renderContentWithQuestions(m.content)}</div>
      </div>

      {m.role === 'assistant' && !isGenerating && (
        <div className="flex items-center space-x-2 justify-end mt-4">
          <p className="text-xs text-slate-500 pl-12">
            {relativeTimeFromDates(m.createdAt!)}
          </p>

          <div className="flex">
            <ExportMessage content={m.content} />
            <CopyMessage content={m.content} />
          </div>
        </div>
      )}
    </div>
  )
}

export default MessageTile
