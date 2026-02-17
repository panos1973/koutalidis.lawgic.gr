/* eslint-disable @next/next/no-img-element */
import { Message } from 'ai'
import { NextPage } from 'next'
import Markdown from 'markdown-to-jsx'
import React from 'react'
import { DocumentText1 } from 'iconsax-react'
import { cn, relativeTimeFromDates } from '@/lib/utils'
import CopyMessage from '@/components/misc/copy_message'
import ExportMessage from '@/components/misc/export_message'
import { saveCaseMessage } from '@/app/[locale]/actions/case_study_actions'
import { useLocale } from 'next-intl'

interface Props {
  message: Message
  isGenerating: boolean
  documentCreationId: string | any
  append: (message: { content: string; role: 'user' | 'assistant' }) => void
  onOpenFile: (filename: string, searchText: string) => void
  scrollToBottom: () => void
  defaultTemplates: any[]
}

const MessageTile: NextPage<Props> = ({
  message: m,
  isGenerating,
  append,
  documentCreationId,
  onOpenFile,
  scrollToBottom,
  defaultTemplates,
}) => {
  const locale = useLocale()
  const handleOpenFile = () => {
    const filename = 'DPA Template 1 English.docx'
    const searchText =
      '2.2. This Data Processing Agreement constitutes an integral and inseparable part of the Service Agreement. In case of conflict, the terms of this Data Processing Agreement shall prevail over those of the Service Agreement.'
    onOpenFile(filename, searchText)
  }
  const handleQuestionClick = (question: string) => {
    // Remove any numbering (e.g., "1.", "2.", etc.)
    const cleanedQuestion = question.replace(/^\d+\.\s*/, '')
    saveCaseMessage(documentCreationId, 'user', cleanedQuestion)
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

    // Convert bullet-pointed headings to proper headings
    // Pattern: • Text followed by colon (section headers)
    // Remove bullet points from section headers that are already bold
    transformedContent = transformedContent.replace(
      /^(\s*)•\s*(\*\*[^*]+\*\*:)\s*$/gm,
      '$1$2'
    )
    // Fix numbered lists - remove newlines between number and content
    transformedContent = transformedContent.replace(
      /^(\s*)(\d+\.)\s*\n\s*/gm,
      '$1$2 '
    )

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

    const getTemplateName = (template: any) => {
      return locale === 'el'
        ? template.title_greek || template.title
        : template.title
    }

    let finalContent = transformedContent
    for (const template of defaultTemplates) {
      const templateName = getTemplateName(template)
      if (finalContent.includes(templateName)) {
        const escapedTemplateName = templateName.replace(
          /[-\/\\^$*+?.()|[\]{}]/g,
          '\\$&'
        )
        const regex = new RegExp(escapedTemplateName, 'g')
        finalContent = finalContent.replace(
          regex,
          `<template>${templateName}</template>`
        )
        // We assume one template per message for now, so we break after the first match.
        break
      }
    }

    return (
      <>
        <div className="prose prose-sm max-w-none">
          <Markdown
            options={{
              overrides: {
                template: {
                  component: ({ children }: any) => (
                    <span className="inline-flex items-center bg-blue-100 border border-blue-300 rounded-lg px-2 py-1 text-xs font-medium text-blue-800 mx-1">
                      <DocumentText1
                        size="14"
                        color="#1e40af"
                        variant="Bold"
                        style={{ marginRight: '4px' }}
                      />
                      {children}
                    </span>
                  ),
                },
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
                  component: ({ children, ...props }: any) => {
                    // Filter out empty list items
                    const filteredChildren = React.Children.toArray(
                      children
                    ).filter((child: any) => {
                      if (React.isValidElement(child) && child.type === 'li') {
                        const childProps = child.props as any
                        const content = React.Children.toArray(
                          childProps.children
                        )
                        return content.some(
                          (c) =>
                            (typeof c === 'string' && c.trim().length > 0) ||
                            React.isValidElement(c)
                        )
                      }
                      return true
                    })

                    return (
                      <ul
                        {...props}
                        className="list-disc list-inside mb-2 space-y-1"
                      >
                        {filteredChildren}
                      </ul>
                    )
                  },
                },
                ol: {
                  props: {
                    className: 'list-decimal list-outside ml-6 mb-2 space-y-1',
                  },
                  component: ({ children, ...props }: any) => {
                    return (
                      <ol
                        {...props}
                        className="list-decimal list-outside ml-6 mb-2 space-y-1"
                      >
                        {React.Children.map(children, (child: any) => {
                          if (
                            React.isValidElement(child) &&
                            child.type === 'li'
                          ) {
                            const childProps = child.props as any
                            return React.cloneElement(
                              child as React.ReactElement<any>,
                              {
                                ...childProps,
                                style: {
                                  ...(childProps.style || {}),
                                  display: 'list-item',
                                  whiteSpace: 'normal',
                                  paddingLeft: '0.5rem',
                                } as React.CSSProperties,
                              }
                            )
                          }
                          return child
                        })}
                      </ol>
                    )
                  },
                },
                li: {
                  props: {
                    className: 'leading-relaxed',
                  },
                  component: ({ children, ...props }: any) => {
                    // Remove leading/trailing whitespace and newlines more aggressively
                    const processedChildren = React.Children.map(
                      children,
                      (child: any) => {
                        if (typeof child === 'string') {
                          return child.replace(/^\s+/, '').replace(/\s+$/, ' ')
                        }
                        return child
                      }
                    )

                    // Check if this list item is a section header (ends with colon)
                    const textContent = React.Children.toArray(
                      processedChildren
                    )
                      .filter((c) => typeof c === 'string')
                      .join('')

                    const isHeader = textContent.trim().endsWith(':')

                    return (
                      <li
                        {...props}
                        className={
                          isHeader
                            ? 'font-bold leading-relaxed'
                            : 'leading-relaxed'
                        }
                        style={
                          {
                            display: isHeader ? 'block' : 'list-item',
                            listStyleType: isHeader ? 'none' : undefined,
                            marginLeft: isHeader ? '-1.5rem' : undefined,
                          } as React.CSSProperties
                        }
                      >
                        {processedChildren}
                      </li>
                    )
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
                    // Regular links with proper styling
                    return (
                      <a
                        {...props}
                        className="text-blue-600 hover:text-blue-800 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {props.children}
                      </a>
                    )
                  },
                },
              },
            }}
          >
            {finalContent}
          </Markdown>
        </div>

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
      className={cn('text-sm mb-6 py-2 px-4 rounded-3xl ', {
        'whitespace-pre-wrap self-end bg-slate-200  max-w-fit  md:max-w-[40svw] rounded-br-none overflow-clip':
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
