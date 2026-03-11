'use client'

import { useState } from 'react'
import { useFocusMode } from './FocusModeProvider'
import { useChatHistoryContext } from './ChatHistoryContext'
import { cn } from '@/lib/utils'
import { MessageSquare, Plus, X, Download, Loader2 } from 'lucide-react'

interface Conversation {
  id: string
  title: string
  updatedAt: string
}

interface ChatHistoryPanelProps {
  conversations?: Conversation[]
  activeConversationId?: string
  onSelectConversation?: (id: string) => void
  onNewConversation?: () => void
}

export function ChatHistoryPanel({
  conversations: propConversations,
  activeConversationId: propActiveId,
  onSelectConversation: propOnSelect,
  onNewConversation: propOnNew,
}: ChatHistoryPanelProps) {
  const { chatHistoryVisible, setChatHistoryVisible } = useFocusMode()
  const ctx = useChatHistoryContext()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Use props if provided, otherwise fall back to context
  const conversations = propConversations ?? ctx?.conversations ?? []
  const activeConversationId = propActiveId ?? ctx?.activeConversationId
  const onSelectConversation = propOnSelect ?? ctx?.onSelectConversation
  const onNewConversation = propOnNew ?? ctx?.onNewConversation
  const onDownload = ctx?.onDownload

  if (!chatHistoryVisible) return null

  const handleDownload = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!onDownload || downloadingId) return
    setDownloadingId(id)
    try {
      await onDownload(id)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div
      className={cn(
        'w-[240px] border-r border-gray-100 bg-white flex flex-col shrink-0 transition-all duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          History
        </span>
        <div className="flex items-center gap-1">
          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            onClick={() => setChatHistoryVisible(false)}
            className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <MessageSquare size={20} className="mb-2" />
            <p className="text-xs">No conversations yet</p>
          </div>
        ) : (
          <ul className="py-1">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <div
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer',
                    activeConversationId === conv.id
                      ? 'bg-red-50 text-[#c5032a] border-r-2 border-[#c5032a]'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                  onClick={() => onSelectConversation?.(conv.id)}
                >
                  <p className="truncate text-xs font-medium">
                    {conv.title || 'Untitled'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                  {onDownload && (
                    <button
                      onClick={(e) => handleDownload(e, conv.id)}
                      disabled={downloadingId === conv.id}
                      className={cn(
                        'mt-1.5 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded',
                        'transition-colors',
                        downloadingId === conv.id
                          ? 'text-gray-400 bg-gray-50 cursor-wait'
                          : 'text-[#c5032a] bg-red-50 hover:bg-red-100'
                      )}
                    >
                      {downloadingId === conv.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Download size={10} />
                      )}
                      {downloadingId === conv.id ? 'Downloading...' : 'Download translation'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
