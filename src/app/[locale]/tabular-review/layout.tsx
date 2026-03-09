import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { FocusModeProvider } from '@/components/koutalidis/layout/FocusModeProvider'
import { KoutalidisHeader } from '@/components/koutalidis/layout/KoutalidisHeader'
import { KoutalidisSidebar } from '@/components/koutalidis/layout/KoutalidisSidebar'
import { BreadcrumbBar } from '@/components/koutalidis/layout/BreadcrumbBar'

function isKoutalidisTenant(): boolean {
  const headersList = headers()
  const host = headersList.get('host') || ''
  return (
    host.includes('koutalidis.lawgic.gr') ||
    process.env.NEXT_PUBLIC_TENANT_ID === 'koutalidis'
  )
}

export const metadata: Metadata = {
  title: 'Lawgic | Tabular Review',
  description: 'AI-powered tabular document review',
}

export default function TabularReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isKoutalidis = isKoutalidisTenant()

  if (isKoutalidis) {
    return (
      <FocusModeProvider>
        <div className="flex flex-col h-screen overflow-hidden font-sans">
          <KoutalidisHeader />
          <div className="flex flex-1 overflow-hidden">
            <KoutalidisSidebar />
            <main className="flex-1 flex flex-col overflow-hidden font-sans">
              <BreadcrumbBar toolName="Tabular Review" />
              <div className="flex-1 overflow-y-auto">{children}</div>
            </main>
          </div>
        </div>
      </FocusModeProvider>
    )
  }

  return (
    <div className="flex flex-col w-full">
      <div className="w-full">{children}</div>
    </div>
  )
}
