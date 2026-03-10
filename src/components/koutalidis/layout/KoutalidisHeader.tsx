'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { Search, ChevronDown } from 'lucide-react'
import { PracticeToolsMegaMenu } from '../navigation/PracticeToolsMegaMenu'
import LocaltySelector from '@/components/navs/localty-selector'

export function KoutalidisHeader() {
  const locale = useLocale()
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const megaMenuRef = useRef<HTMLDivElement>(null)

  // Close mega menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        megaMenuRef.current &&
        !megaMenuRef.current.contains(event.target as Node)
      ) {
        setMegaMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="border-b border-gray-100 bg-white h-14 flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo + Practice Tools */}
      <div className="flex items-center gap-6">
        <Link href={`/${locale}/projects`} className="flex items-center gap-2">
          <img src="/miniLogo.png" alt="Lawgic" className="h-6 w-6 object-contain" />
          <h6 className="font-semibold tracking-wider text-[#c5032a] uppercase text-sm">
            Lawgic
          </h6>
        </Link>

        {/* Practice Tools Mega Menu Trigger */}
        <div ref={megaMenuRef} className="relative">
          <button
            onClick={() => setMegaMenuOpen(!megaMenuOpen)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-50"
          >
            Εργαλεία ανά Practice
            <ChevronDown
              size={14}
              className={`transition-transform ${megaMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {megaMenuOpen && (
            <PracticeToolsMegaMenu onClose={() => setMegaMenuOpen(false)} />
          )}
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools, projects..."
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-1 focus:ring-[#c5032a]/30 focus:border-[#c5032a]/30
                       placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Right: Org switcher, locale, user */}
      <div className="flex items-center gap-3">
        <OrganizationSwitcher
          hidePersonal={true}
          createOrganizationMode="navigation"
          createOrganizationUrl={`/${locale}/organization/create`}
        />
        <LocaltySelector />
        <UserButton afterSignOutUrl={`/${locale}/sign-in`} />
      </div>
    </header>
  )
}
