'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

interface Project {
  id: string
  name: string
  clientName?: string | null
  description?: string | null
  practiceAreas?: string[] | null
  status?: string | null
}

interface ProjectContextValue {
  activeProject: Project | null
  setActiveProject: (project: Project | null) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({
  children,
  initialProject,
}: {
  children: React.ReactNode
  initialProject?: Project | null
}) {
  const [activeProject, setActiveProjectState] = useState<Project | null>(
    initialProject || null
  )

  const setActiveProject = useCallback((project: Project | null) => {
    setActiveProjectState(project)
  }, [])

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context)
    throw new Error('useProject must be used within ProjectProvider')
  return context
}
