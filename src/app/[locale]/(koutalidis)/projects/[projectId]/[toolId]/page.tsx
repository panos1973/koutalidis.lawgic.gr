'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useChat } from 'ai/react'
import { Send, Paperclip, Loader2, Upload, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOOL_API_ROUTES } from '@/lib/koutalidis/practice-areas'
import { TOOL_WELCOME_MESSAGES } from '@/lib/koutalidis/tool-welcome-messages'

interface PageProps {
  params: {
    locale: string
    projectId: string
    toolId: string
  }
}

export default function ToolChatPage({ params }: PageProps) {
  const { locale, projectId, toolId } = params
  const apiRoute = TOOL_API_ROUTES[toolId]
  const welcome = TOOL_WELCOME_MESSAGES[toolId]
  const isGreek = locale === 'el'
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ name: string; content: string }>
  >([])

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: apiRoute ? `/${locale}${apiRoute}` : `/${locale}/api/chat`,
      body: {
        toolId,
        projectId,
        locale,
      },
    })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      // For text-based files, read as text
      const reader = new FileReader()
      reader.onload = () => {
        setAttachedFiles((prev) => [
          ...prev,
          { name: file.name, content: reader.result as string },
        ])
      }
      reader.readAsText(file)
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && attachedFiles.length === 0) return

    // If there are attached files, prepend their contents to the message
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles
        .map(
          (f) =>
            `--- Uploaded Document: ${f.name} ---\n${f.content}\n--- End of ${f.name} ---`
        )
        .join('\n\n')

      const augmentedInput = fileContext + '\n\n' + (input || 'Please process the uploaded document(s) according to the tool instructions.')

      // Create a synthetic event and override input
      const syntheticEvent = {
        ...e,
        preventDefault: () => {},
      }

      // We need to use the handleSubmit with modified content
      // The useChat hook allows us to pass extra options
      handleSubmit(syntheticEvent as any, {
        data: { fileContext },
      })

      setAttachedFiles([])
    } else {
      handleSubmit(e)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && welcome && (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {isGreek ? welcome.titleEl : welcome.title}
              </h2>
              <p className="text-sm text-gray-500">
                {isGreek ? welcome.descriptionEl : welcome.description}
              </p>
            </div>

            <div className="w-full bg-gray-50 border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                {isGreek ? 'Πώς να ξεκινήσετε' : 'How to get started'}
              </p>
              <ol className="space-y-2">
                {(isGreek ? welcome.stepsEl : welcome.steps).map(
                  (step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 text-sm text-gray-600"
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#c5032a]/10 text-[#c5032a] text-xs flex items-center justify-center font-medium">
                        {idx + 1}
                      </span>
                      {step}
                    </li>
                  )
                )}
              </ol>
            </div>
          </div>
        )}

        {messages.length === 0 && !welcome && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-medium mb-2">
              {isGreek ? 'Ξεκινήστε μια συνομιλία' : 'Start a conversation'}
            </p>
            <p className="text-sm">
              {isGreek
                ? 'Κάντε ερωτήσεις ή ανεβάστε έγγραφα για να ξεκινήσετε.'
                : 'Ask questions or upload documents to begin working with this tool.'}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-3xl mx-auto',
              message.role === 'user' ? 'ml-auto' : ''
            )}
          >
            <div
              className={cn(
                'px-4 py-3 rounded-xl text-sm',
                message.role === 'user'
                  ? 'bg-[#c5032a] text-white ml-auto max-w-[80%]'
                  : 'bg-gray-50 border border-gray-100'
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              {isGreek ? 'Επεξεργασία...' : 'Thinking...'}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 p-4">
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600"
              >
                <FileText size={12} />
                <span className="max-w-[200px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleFormSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            title={isGreek ? 'Επισύναψη εγγράφου' : 'Attach document'}
          >
            <Paperclip size={16} />
          </button>
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={handleInputChange}
              placeholder={
                isGreek
                  ? 'Πληκτρολογήστε το μήνυμά σας...'
                  : 'Type your message...'
              }
              rows={1}
              className="w-full px-4 py-3 pr-12 text-sm border border-gray-200 rounded-xl resize-none
                         focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30 focus:border-[#c5032a]/30
                         placeholder:text-gray-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleFormSubmit(e as any)
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
            className="p-3 rounded-xl bg-[#c5032a] text-white hover:bg-[#a5021f]
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          {isGreek
            ? 'Η AI μπορεί να κάνει λάθη. Ελέγξτε σημαντικές πληροφορίες.'
            : 'AI can make mistakes. Review important information.'}
        </p>
      </div>
    </div>
  )
}
