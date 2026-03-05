'use client'

import { useState, useCallback, useEffect } from 'react'

interface SidebarState {
  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
}

export function useSidebarState(defaultCollapsed = false): SidebarState {
  const [collapsed, setCollapsedState] = useState(defaultCollapsed)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('koutalidis_sidebar_collapsed')
      if (saved !== null) {
        setCollapsedState(JSON.parse(saved))
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    try {
      localStorage.setItem(
        'koutalidis_sidebar_collapsed',
        JSON.stringify(value)
      )
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed)
  }, [collapsed, setCollapsed])

  return { collapsed, toggleCollapsed, setCollapsed }
}
