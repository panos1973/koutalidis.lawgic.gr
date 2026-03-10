'use client'

import { useFocusMode } from './FocusModeProvider'
import { useChatHistoryContext } from './ChatHistoryContext'
import { cn } from '@/lib/utils'
import { MessageSquare, Plus, X } from 'lucide-react'

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

  // Use props if provided, otherwise fall back to context
  const conversations = propConversations ?? ctx?.conversations ?? []
  const activeConversationId = propActiveId ?? ctx?.activeConversationId
  const onSelectConversation = propOnSelect ?? ctx?.onSelectConversation
  const onNewConversation = propOnNew ?? ctx?.onNewConversation

  if (!chatHistoryVisible) return null

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
                <button
                  onClick={() => onSelectConversation?.(conv.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors',
                    activeConversationId === conv.id
                      ? 'bg-red-50 text-[#c5032a] border-r-2 border-[#c5032a]'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <p className="truncate text-xs font-medium">
                    {conv.title || 'Untitled'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
