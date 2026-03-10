'use client'

import { useFocusMode } from './FocusModeProvider'
import { cn } from '@/lib/utils'
import {
  PanelLeftClose,
  PanelLeft,
  FolderKanban,
  Wrench,
} from 'lucide-react'
import { ProjectSelector } from '../navigation/ProjectSelector'
import { ToolTree } from '../navigation/ToolTree'
import { GeneralToolsSection } from '../navigation/GeneralToolsSection'

export function KoutalidisSidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useFocusMode()

  return (
    <aside
      className={cn(
        'border-r border-gray-100 bg-gray-50/50 flex flex-col shrink-0 transition-all duration-200 overflow-hidden',
        sidebarCollapsed ? 'w-[52px]' : 'w-[252px]'
      )}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-3 py-2">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
        >
          {sidebarCollapsed ? (
            <PanelLeft size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Projects Section */}
        <div className="border-b border-gray-100">
          {sidebarCollapsed ? (
            <div className="flex justify-center py-3">
              <FolderKanban size={18} className="text-gray-400" />
            </div>
          ) : (
            <ProjectSelector />
          )}
        </div>

        {/* Practice Tools (contextual - shows based on active project's practice areas) */}
        <div className="border-b border-gray-100">
          {sidebarCollapsed ? (
            <div className="flex justify-center py-3">
              <Wrench size={18} className="text-gray-400" />
            </div>
          ) : (
            <ToolTree />
          )}
        </div>

        {/* General Tools */}
        <div>
          {!sidebarCollapsed && <GeneralToolsSection />}
        </div>
      </div>
    </aside>
  )
}
