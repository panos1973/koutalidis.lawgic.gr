'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRACTICE_AREAS } from '@/lib/koutalidis/practice-areas'
import { PracticeIcon } from '../icons/PracticeIcons'
import { createProject } from '@/lib/koutalidis/project-actions'

interface NewProjectModalProps {
  open: boolean
  onClose: () => void
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const locale = useLocale()
  const router = useRouter()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  if (!open) return null

  const toggleArea = (areaId: string) => {
    const next = new Set(selectedAreas)
    if (next.has(areaId)) {
      next.delete(areaId)
    } else {
      next.add(areaId)
    }
    setSelectedAreas(next)
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)

    try {
      const project = await createProject({
        name: name.trim(),
        clientName: clientName.trim() || undefined,
        description: description.trim() || undefined,
        practiceAreas: Array.from(selectedAreas),
      })

      onClose()
      router.push(`/${locale}/projects/${project.id}`)
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            New Project
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Alpha Bank Bond Issue"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30 focus:border-[#c5032a]/30"
            />
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client (optional)
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Alpha Bank S.A."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30 focus:border-[#c5032a]/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none
                         focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30 focus:border-[#c5032a]/30"
            />
          </div>

          {/* Practice Areas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Practice Areas
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRACTICE_AREAS.map((area) => {
                const isSelected = selectedAreas.has(area.id)
                return (
                  <button
                    key={area.id}
                    onClick={() => toggleArea(area.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                      isSelected
                        ? 'border-current bg-opacity-10'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    style={
                      isSelected
                        ? {
                            color: area.color,
                            backgroundColor: `${area.color}10`,
                            borderColor: area.color,
                          }
                        : undefined
                    }
                  >
                    <PracticeIcon
                      iconName={area.icon}
                      size={14}
                      style={{ color: isSelected ? area.color : '#9ca3af' }}
                    />
                    <span className={isSelected ? 'font-medium' : 'text-gray-600'}>
                      {locale === 'el' ? area.nameEl : area.name}
                    </span>
                    {isSelected && (
                      <Check size={12} className="ml-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-4 py-2 text-sm font-medium text-white bg-[#c5032a] rounded-lg
                       hover:bg-[#a5021f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
