import { FocusModeProvider } from '@/components/koutalidis/layout/FocusModeProvider'
import { KoutalidisHeader } from '@/components/koutalidis/layout/KoutalidisHeader'
import { KoutalidisSidebar } from '@/components/koutalidis/layout/KoutalidisSidebar'
import { ChatHistoryPanel } from '@/components/koutalidis/layout/ChatHistoryPanel'
import { ChatHistoryProvider } from '@/components/koutalidis/layout/ChatHistoryContext'
import { BreadcrumbBar } from '@/components/koutalidis/layout/BreadcrumbBar'
import { TranslationNotifier } from '@/components/translate/TranslationNotifier'

export default function KoutalidisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FocusModeProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <KoutalidisHeader />
        <div className="flex flex-1 overflow-hidden">
          <KoutalidisSidebar />
          <ChatHistoryProvider>
            <ChatHistoryPanel />
            <main className="flex-1 flex flex-col overflow-hidden">
              <BreadcrumbBar />
              {children}
            </main>
          </ChatHistoryProvider>
        </div>
      </div>
      <TranslationNotifier />
    </FocusModeProvider>
  )
}
