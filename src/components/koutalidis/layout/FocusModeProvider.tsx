'use client'

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react'

interface FocusModeState {
  focusMode: boolean
  sidebarCollapsed: boolean
  chatHistoryVisible: boolean
  toggleFocusMode: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setChatHistoryVisible: (visible: boolean) => void
}

const FocusModeContext = createContext<FocusModeState | null>(null)

export function FocusModeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [focusMode, setFocusMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatHistoryVisible, setChatHistoryVisible] = useState(true)
  const preFocusState = useRef({ sidebar: false, chat: true })

  const toggleFocusMode = useCallback(() => {
    if (!focusMode) {
      preFocusState.current = {
        sidebar: sidebarCollapsed,
        chat: chatHistoryVisible,
      }
      setSidebarCollapsed(true)
      setChatHistoryVisible(false)
      setFocusMode(true)
    } else {
      setSidebarCollapsed(preFocusState.current.sidebar)
      setChatHistoryVisible(preFocusState.current.chat)
      setFocusMode(false)
    }
  }, [focusMode, sidebarCollapsed, chatHistoryVisible])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleFocusMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode])

  return (
    <FocusModeContext.Provider
      value={{
        focusMode,
        sidebarCollapsed,
        chatHistoryVisible,
        toggleFocusMode,
        setSidebarCollapsed,
        setChatHistoryVisible,
      }}
    >
      {children}
    </FocusModeContext.Provider>
  )
}

export function useFocusMode() {
  const context = useContext(FocusModeContext)
  if (!context)
    throw new Error('useFocusMode must be used within FocusModeProvider')
  return context
}
