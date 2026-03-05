'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  FolderKanban,
  Plus,
  Clock,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRACTICE_AREAS } from '@/lib/koutalidis/practice-areas'
import { PracticeIcon } from '@/components/koutalidis/icons/PracticeIcons'
import { NewProjectModal } from '@/components/koutalidis/projects/NewProjectModal'
import { getProjects } from '@/lib/koutalidis/project-actions'

interface Project {
  id: string
  name: string
  clientName: string | null
  description: string | null
  practiceAreas: string[] | null
  status: string | null
  createdAt: Date | null
  updatedAt: Date | null
}

export default function ProjectsPage() {
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(
    searchParams.get('new') === 'true'
  )

  useEffect(() => {
    getProjects()
      .then((data) => setProjects(data as Project[]))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your legal projects and matters
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#c5032a] rounded-lg
                     hover:bg-[#a5021f] transition-colors"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <FolderKanban size={48} className="mb-4" />
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm mt-1">
            Create your first project to get started
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#c5032a] border border-[#c5032a] rounded-lg
                       hover:bg-red-50 transition-colors"
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/${locale}/projects/${project.id}`}
              className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-[#c5032a] transition-colors">
                  {project.name}
                </h3>
                <div
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium',
                    project.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {project.status}
                </div>
              </div>

              {project.clientName && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                  <Users size={12} />
                  {project.clientName}
                </div>
              )}

              {project.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                  {project.description}
                </p>
              )}

              {/* Practice area tags */}
              {project.practiceAreas && project.practiceAreas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.practiceAreas.map((areaId) => {
                    const area = PRACTICE_AREAS.find((a) => a.id === areaId)
                    if (!area) return null
                    return (
                      <span
                        key={areaId}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: `${area.color}15`,
                          color: area.color,
                        }}
                      >
                        <PracticeIcon iconName={area.icon} size={10} />
                        {locale === 'el' ? area.nameEl : area.name}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <Clock size={10} />
                {project.updatedAt
                  ? new Date(project.updatedAt).toLocaleDateString()
                  : 'N/A'}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        open={showNewModal}
        onClose={() => {
          setShowNewModal(false)
          // Refresh projects
          getProjects()
            .then((data) => setProjects(data as Project[]))
            .catch(console.error)
        }}
      />
    </div>
  )
}
