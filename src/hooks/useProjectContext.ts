'use client'

import { useState, useCallback, useEffect } from 'react'

interface ProjectContextState {
  activeProjectId: string | null
  activePracticeArea: string | null
  activeToolId: string | null
  setActiveProject: (projectId: string | null) => void
  setActivePracticeArea: (areaId: string | null) => void
  setActiveTool: (toolId: string | null) => void
}

export function useProjectContext(): ProjectContextState {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activePracticeAreaState, setActivePracticeAreaState] = useState<string | null>(null)
  const [activeToolId, setActiveToolId] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('koutalidis_project_context')
      if (saved) {
        const parsed = JSON.parse(saved)
        setActiveProjectId(parsed.projectId || null)
        setActivePracticeAreaState(parsed.practiceArea || null)
        setActiveToolId(parsed.toolId || null)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const setActiveProject = useCallback(
    (projectId: string | null) => {
      setActiveProjectId(projectId)
      try {
        const saved = localStorage.getItem('koutalidis_project_context')
        const context = saved ? JSON.parse(saved) : {}
        context.projectId = projectId
        localStorage.setItem(
          'koutalidis_project_context',
          JSON.stringify(context)
        )
      } catch {
        // Ignore localStorage errors
      }
    },
    []
  )

  const setActivePracticeArea = useCallback(
    (areaId: string | null) => {
      setActivePracticeAreaState(areaId)
      try {
        const saved = localStorage.getItem('koutalidis_project_context')
        const context = saved ? JSON.parse(saved) : {}
        context.practiceArea = areaId
        localStorage.setItem(
          'koutalidis_project_context',
          JSON.stringify(context)
        )
      } catch {
        // Ignore localStorage errors
      }
    },
    []
  )

  const setActiveTool = useCallback(
    (toolId: string | null) => {
      setActiveToolId(toolId)
      try {
        const saved = localStorage.getItem('koutalidis_project_context')
        const context = saved ? JSON.parse(saved) : {}
        context.toolId = toolId
        localStorage.setItem(
          'koutalidis_project_context',
          JSON.stringify(context)
        )
      } catch {
        // Ignore localStorage errors
      }
    },
    []
  )

  return {
    activeProjectId,
    activePracticeArea: activePracticeAreaState,
    activeToolId,
    setActiveProject,
    setActivePracticeArea,
    setActiveTool,
  }
}
