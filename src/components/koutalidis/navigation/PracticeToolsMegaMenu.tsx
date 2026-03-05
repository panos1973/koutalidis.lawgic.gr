'use client'

import { useLocale } from 'next-intl'
import Link from 'next/link'
import {
  PRACTICE_AREAS,
  PRACTICE_TOOLS_BY_AREA,
} from '@/lib/koutalidis/practice-areas'
import { PracticeIcon } from '../icons/PracticeIcons'

interface PracticeToolsMegaMenuProps {
  onClose: () => void
}

export function PracticeToolsMegaMenu({ onClose }: PracticeToolsMegaMenuProps) {
  const locale = useLocale()

  return (
    <div className="absolute top-full left-0 mt-2 w-[720px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-6">
      <div className="grid grid-cols-3 gap-6">
        {PRACTICE_AREAS.map((area) => {
          const tools = PRACTICE_TOOLS_BY_AREA[area.id]

          return (
            <div key={area.id} className="space-y-2">
              {/* Practice area header */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: `${area.color}15` }}
                >
                  <PracticeIcon
                    iconName={area.icon}
                    size={14}
                    style={{ color: area.color }}
                  />
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: area.color }}
                >
                  {locale === 'el' ? area.nameEl : area.name}
                </span>
              </div>

              {/* Tools under this area */}
              {tools ? (
                <div className="space-y-1">
                  {Object.entries(tools).map(([category, categoryTools]) => (
                    <div key={category}>
                      <p className="text-[10px] uppercase text-gray-400 font-medium tracking-wider mb-1">
                        {category}
                      </p>
                      {categoryTools.map((tool) => (
                        <Link
                          key={tool.id}
                          href={`/${locale}/tools/${tool.id}`}
                          onClick={onClose}
                          className="flex items-center gap-2 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        >
                          <PracticeIcon
                            iconName={tool.icon}
                            size={12}
                            className="text-gray-400"
                          />
                          {locale === 'el' ? tool.nameEl : tool.name}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Coming soon</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
