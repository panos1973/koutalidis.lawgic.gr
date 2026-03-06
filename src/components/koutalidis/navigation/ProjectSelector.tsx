'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  FolderKanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProjects } from '@/lib/koutalidis/project-actions'

interface Project {
  id: string
  name: string
  clientName: string | null
  practiceAreas: string[] | null
  status: string | null
}

export function ProjectSelector() {
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (expanded && projects.length === 0) {
      setLoading(true)
      getProjects()
        .then((data) => setProjects(data as Project[]))
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [expanded, projects.length])

  return (
    <div className="px-3 py-2">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <FolderKanban size={13} />
          <span>Projects</span>
        </div>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {/* Project list */}
      {expanded && (
        <div className="mt-2 space-y-0.5">
          {loading ? (
            <p className="text-xs text-gray-400 py-2 text-center">
              Loading...
            </p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">
              No projects yet
            </p>
          ) : (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/${locale}/projects/${project.id}`}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                  'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="truncate">{project.name}</span>
              </Link>
            ))
          )}

          {/* New project button */}
          <Link
            href={`/${locale}/projects?new=true`}
            className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#c5032a] hover:bg-red-50 transition-colors mt-1"
          >
            <Plus size={12} />
            <span>New Project</span>
          </Link>
        </div>
      )}
    </div>
  )
}
