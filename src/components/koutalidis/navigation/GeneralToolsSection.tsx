'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GENERAL_TOOLS } from '@/lib/koutalidis/practice-areas'
import { PracticeIcon } from '../icons/PracticeIcons'

const STORAGE_KEY = 'koutalidis_general_tools_expanded'

export function GeneralToolsSection() {
  const locale = useLocale()
  const pathname = usePathname()
  const isOnGeneralTool = GENERAL_TOOLS.some((tool) => pathname.includes(tool.route))

  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(STORAGE_KEY)
    // Default to expanded; only collapse if user explicitly collapsed
    return stored === null ? true : stored === 'true'
  })

  useEffect(() => {
    if (isOnGeneralTool) setExpanded(true)
  }, [isOnGeneralTool])

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return (
    <div className="px-3 py-2">
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
      >
        <span>General Tools</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-0.5">
          {GENERAL_TOOLS.map((tool) => {
            const isActive = pathname.includes(tool.route)

            return (
              <Link
                key={tool.id}
                href={`/${locale}${tool.route}`}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                  isActive
                    ? 'bg-red-50 text-[#c5032a] font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <PracticeIcon
                  iconName={tool.icon}
                  size={14}
                  className={isActive ? 'text-[#c5032a]' : 'text-gray-400'}
                />
                <span>{locale === 'el' ? tool.nameEl : tool.name}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
