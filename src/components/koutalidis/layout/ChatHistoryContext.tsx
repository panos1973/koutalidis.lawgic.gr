'use client'

import { createContext, useCallback, useContext, useState } from 'react'

interface Conversation {
  id: string
  title: string
  updatedAt: string
}

export interface ChatHistoryContextValue {
  conversations: Conversation[]
  activeConversationId?: string
  onSelectConversation?: (id: string) => void
  onNewConversation?: () => void
  onDownload?: (id: string) => void
}

interface ChatHistoryStore {
  value: ChatHistoryContextValue | null
  /** Pages call this to push their history data into the layout-level provider */
  setValue: (v: ChatHistoryContextValue | null) => void
}

const ChatHistoryStoreContext = createContext<ChatHistoryStore>({
  value: null,
  setValue: () => {},
})

/**
 * Layout-level provider that wraps both ChatHistoryPanel and <main>.
 * Pages (like translate) call `useSetChatHistory()` to push data up.
 */
export function ChatHistoryProvider({ children }: { children: React.ReactNode }) {
  const [value, setValueRaw] = useState<ChatHistoryContextValue | null>(null)

  const setValue = useCallback((v: ChatHistoryContextValue | null) => {
    setValueRaw(v)
  }, [])

  return (
    <ChatHistoryStoreContext.Provider value={{ value, setValue }}>
      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>
    </ChatHistoryStoreContext.Provider>
  )
}

/** Used by ChatHistoryPanel to read the current history */
export function useChatHistoryContext(): ChatHistoryContextValue | null {
  const store = useContext(ChatHistoryStoreContext)
  return store.value
}

/** Used by pages (translate) to push history data into the layout-level context */
export function useSetChatHistory() {
  const store = useContext(ChatHistoryStoreContext)
  return store.setValue
}

// Keep the raw context for backwards compat (not actively used now)
export const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null)
