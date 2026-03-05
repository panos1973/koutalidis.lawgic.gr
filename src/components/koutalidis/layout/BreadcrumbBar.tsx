'use client'

import { useState } from 'react'
import { useFocusMode } from './FocusModeProvider'
import { Maximize2, Minimize2, Clock, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbBarProps {
  projectName?: string
  practiceArea?: { name: string; color: string }
  category?: string
  toolName?: string
}

export function BreadcrumbBar({
  projectName,
  practiceArea,
  category,
  toolName,
}: BreadcrumbBarProps) {
  const {
    focusMode,
    toggleFocusMode,
    chatHistoryVisible,
    setChatHistoryVisible,
  } = useFocusMode()
  const [tooltipVisible, setTooltipVisible] = useState(false)

  return (
    <div
      className={cn(
        'px-5 py-2.5 flex items-center justify-between border-b transition-all duration-200',
        focusMode
          ? 'bg-red-50 border-red-200'
          : 'bg-white border-gray-100'
      )}
    >
      {/* Breadcrumb trail */}
      <nav className="flex items-center gap-1.5 text-xs">
        {projectName && (
          <>
            <span className="text-gray-400">{projectName}</span>
            {practiceArea && (
              <>
                <span className="text-gray-300">&rsaquo;</span>
                <span style={{ color: practiceArea.color }}>
                  {practiceArea.name}
                </span>
              </>
            )}
            {category && (
              <>
                <span className="text-gray-300">&rsaquo;</span>
                <span className="text-gray-400">{category}</span>
              </>
            )}
            {toolName && (
              <>
                <span className="text-gray-300">&rsaquo;</span>
                <span className="font-semibold text-gray-900">{toolName}</span>
              </>
            )}
          </>
        )}
        {!projectName && (
          <span className="text-gray-400">Koutalidis Law Firm</span>
        )}
      </nav>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        {/* History toggle */}
        <button
          onClick={() => setChatHistoryVisible(!chatHistoryVisible)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 text-gray-400
                     hover:border-gray-300 hover:text-gray-600 transition-all text-[11px]"
        >
          <Clock size={12} />
          {chatHistoryVisible ? 'Hide' : 'History'}
        </button>

        {/* Focus Mode button */}
        <div className="relative">
          <button
            onClick={toggleFocusMode}
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all text-[11px]',
              focusMode
                ? 'bg-red-50 border-[#c5032a] text-[#c5032a] font-medium'
                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
            )}
          >
            {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {focusMode ? 'Exit Focus' : 'Focus'}
          </button>

          {tooltipVisible && (
            <div
              className="absolute top-full right-0 mt-1.5 z-50
                          bg-gray-900 text-white text-[11px] px-2.5 py-1.5 rounded-md
                          whitespace-nowrap shadow-lg
                          flex items-center gap-2"
            >
              <span>
                {focusMode ? 'Restore panels' : 'Hide sidebar & history'}
              </span>
              <kbd className="bg-white/15 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                ⌘ \
              </kbd>
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          className="flex items-center px-2 py-1 rounded-md border border-gray-200
                         text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-all"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  )
}
