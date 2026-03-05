import type { Metadata } from 'next'

import { Suspense } from 'react'
import { headers } from 'next/headers'
import ChatHistoryLoader from '@/components/chat/chat_history_loader'
import DocumentCreationHistory from '@/components/document-creation/document_creation_history'
import CreateNewDocumentCreation from '@/components/document-creation/create_new_document_creation'
import DocumentCreationMobileTopNav from '@/components/document-creation/mobile_top_nav'
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
  title: 'Lawgic | Document Creation',
  description: 'Document Creation',
}

export default function DocumentCreationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isKoutalidis = isKoutalidisTenant()

  if (isKoutalidis) {
    return (
      <FocusModeProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <KoutalidisHeader />
          <div className="flex flex-1 overflow-hidden">
            <KoutalidisSidebar />
            <div className="w-[300px] border-r border-gray-100 bg-white flex flex-col shrink-0">
              <div className="px-3 py-3 border-b border-gray-100">
                <CreateNewDocumentCreation variant="outline" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <Suspense fallback={<ChatHistoryLoader />}>
                  <DocumentCreationHistory />
                </Suspense>
              </div>
            </div>
            <main className="flex-1 flex flex-col overflow-hidden">
              <BreadcrumbBar toolName="Δημιουργία Εγγράφου" />
              <div className="flex-1 overflow-y-auto">{children}</div>
            </main>
          </div>
        </div>
      </FocusModeProvider>
    )
  }

  return (
    <div className="flex flex-col md:flex-row w-full">
      <div className="hidden md:block w-[15%] md:w-[20%]  border-r border-slate-100 h-[93svh]  bg-slate-50 py-4 overflow-y-hidden">
        <div className="px-2 pb-4">
          <CreateNewDocumentCreation variant="outline" />
        </div>
        <Suspense fallback={<ChatHistoryLoader />}>
          <DocumentCreationHistory />
        </Suspense>
      </div>
      <div className="md:hidden">
        <DocumentCreationMobileTopNav />
      </div>
      <div className=" w-full  md:w-[85%]">{children}</div>
    </div>
  )
}
