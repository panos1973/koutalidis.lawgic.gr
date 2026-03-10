'use client'

import { useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PRACTICE_AREAS,
  PRACTICE_TOOLS_BY_AREA,
} from '@/lib/koutalidis/practice-areas'
import { PracticeIcon } from '../icons/PracticeIcons'

// Both areas and categories always start collapsed; expand only on user click

export function ToolTree() {
  const locale = useLocale()

  // Default: all practice areas collapsed
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(
    new Set()
  )
  // Categories always start collapsed; user can expand during session
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  )

  const toggleArea = useCallback((areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) {
        next.delete(areaId)
      } else {
        next.add(areaId)
      }
      return next
    })
  }, [])

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  return (
    <div className="px-3 py-2">
      <p className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
        Εργαλεία ανά Practice
      </p>

      <div className="space-y-0.5">
        {PRACTICE_AREAS.map((area) => {
          const tools = PRACTICE_TOOLS_BY_AREA[area.id]
          const isExpanded = expandedAreas.has(area.id)

          return (
            <div key={area.id}>
              {/* Practice area header */}
              <button
                onClick={() => toggleArea(area.id)}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors',
                  isExpanded
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <PracticeIcon
                  iconName={area.icon}
                  size={14}
                  style={{ color: area.color }}
                />
                <span className="flex-1 text-left font-medium">
                  {locale === 'el' ? area.nameEl : area.name}
                </span>
                {tools &&
                  (isExpanded ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  ))}
              </button>

              {/* Categories & tools */}
              {isExpanded && tools && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {Object.entries(tools).map(([category, categoryTools]) => {
                    const catKey = `${area.id}-${category}`
                    const catExpanded = expandedCategories.has(catKey)

                    return (
                      <div key={catKey}>
                        <button
                          onClick={() => toggleCategory(catKey)}
                          className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          {catExpanded ? (
                            <ChevronDown size={10} />
                          ) : (
                            <ChevronRight size={10} />
                          )}
                          <span className="uppercase tracking-wider font-medium">
                            {category}
                          </span>
                        </button>

                        {catExpanded && (
                          <div className="ml-3 space-y-0.5">
                            {categoryTools.map((tool) => (
                              <Link
                                key={tool.id}
                                href={`/${locale}/tools/${tool.id}`}
                                className="flex items-center gap-2 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                              >
                                <PracticeIcon
                                  iconName={tool.icon}
                                  size={11}
                                  className="text-gray-400"
                                />
                                {locale === 'el' ? tool.nameEl : tool.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
