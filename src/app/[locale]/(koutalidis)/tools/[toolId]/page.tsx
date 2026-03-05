'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { useChat } from 'ai/react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOOL_API_ROUTES } from '@/lib/koutalidis/practice-areas'

interface PageProps {
  params: {
    locale: string
    toolId: string
  }
}

export default function DirectToolPage({ params }: PageProps) {
  const { locale, toolId } = params
  const apiRoute = TOOL_API_ROUTES[toolId]

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: apiRoute ? `/${locale}${apiRoute}` : `/${locale}/api/chat`,
      body: {
        toolId,
        locale,
      },
    })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-medium mb-2">
              Start a conversation
            </p>
            <p className="text-sm">
              Ask questions or upload documents to begin working with this tool.
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
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 p-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2"
        >
          <div className="flex-1">
            <textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              rows={1}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl resize-none
                         focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30 focus:border-[#c5032a]/30
                         placeholder:text-gray-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e as any)
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 rounded-xl bg-[#c5032a] text-white hover:bg-[#a5021f]
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          AI can make mistakes. Review important information.
        </p>
      </div>
    </div>
  )
}
