'use client'

import { createContext, useContext } from 'react'

interface Conversation {
  id: string
  title: string
  updatedAt: string
}

interface ChatHistoryContextValue {
  conversations: Conversation[]
  activeConversationId?: string
  onSelectConversation?: (id: string) => void
  onNewConversation?: () => void
}

export const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null)

export function useChatHistoryContext() {
  return useContext(ChatHistoryContext)
}
