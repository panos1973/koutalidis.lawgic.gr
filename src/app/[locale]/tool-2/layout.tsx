import type { Metadata } from 'next'

import { Suspense } from 'react'
import ChatHistoryLoader from '@/components/chat/chat_history_loader'
import { getTranslations } from 'next-intl/server'
import CreateNewTool2Chat from '@/components/tool-2/create_new_tool_2_chat'
import Tool2History from '@/components/tool-2/tool_2_history'
import Tool2MobileTopNav from '@/components/tool-2/mobile_top_nav'

export const metadata: Metadata = {
  title: 'Lawgic | Case Study',
  description: 'Case Study',
}

export default async function Tool2Layout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: { lang: string }
}>) {
  const t = await getTranslations('tool2.home')

  return (
    <div className="flex flex-col md:flex-row w-full">
      <div className="hidden md:block w-[15%] md:w-[20%]  border-r border-slate-100 h-[93svh]  bg-slate-50 py-4 overflow-y-hidden">
        <div className="px-2 pb-4">
          <CreateNewTool2Chat variant="outline" />
        </div>

        <Suspense fallback={<ChatHistoryLoader />}>
          <Tool2History />
        </Suspense>
      </div>
      <div className="md:hidden">
        <Tool2MobileTopNav />
      </div>
      <div className=" w-full  md:w-[85%]">{children}</div>
    </div>
  )
}
