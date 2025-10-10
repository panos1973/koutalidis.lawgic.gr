import type { Metadata } from 'next'

import { Suspense } from 'react'
import ChatHistory from '@/components/chat/chat_history'
import ChatHistoryLoader from '@/components/chat/chat_history_loader'
import CreateNewChat from '@/components/chat/create_new_chat'
import DocumentCreationHistory from '@/components/document-creation/document_creation_history'
import CreateNewDocumentCreation from '@/components/document-creation/create_new_document_creation'
import DocumentCreationMobileTopNav from '@/components/document-creation/mobile_top_nav'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Lawgic | Document Creation',
  description: 'Document Creation',
}

export default function DocumentCreationLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: { lang: string }
}>) {
  return (
    <div className="flex flex-col md:flex-row w-full">
      <div className="hidden md:block w-[15%] md:w-[20%]  border-r border-slate-100 h-[93svh]  bg-slate-50 py-4 overflow-y-hidden">
        <div className="px-2 pb-4">
          <CreateNewDocumentCreation variant="outline" />
        </div>
        {/* <div className="flex mb-4 justify-between items-center px-2">
          <p className="text-xs font-semibold tracking-wide uppercase text-slate-600">
            {t("documents")}
          </p>
        </div> */}
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
