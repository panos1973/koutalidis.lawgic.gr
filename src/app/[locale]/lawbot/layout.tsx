// layout.tsx

import { Suspense } from "react";
import { headers } from "next/headers";
import ChatHistory from "@/components/chat/chat_history";
import ChatHistoryLoader from "@/components/chat/chat_history_loader";
import CreateNewChat from "@/components/chat/create_new_chat";
import LawbotMobileTopNav from "@/components/chat/mobile_top_nav";
import { FocusModeProvider } from "@/components/koutalidis/layout/FocusModeProvider";
import { KoutalidisHeader } from "@/components/koutalidis/layout/KoutalidisHeader";
import { KoutalidisSidebar } from "@/components/koutalidis/layout/KoutalidisSidebar";
import { BreadcrumbBar } from "@/components/koutalidis/layout/BreadcrumbBar";

function isKoutalidisTenant(): boolean {
  const headersList = headers();
  const host = headersList.get("host") || "";
  return (
    host.includes("koutalidis.lawgic.gr") ||
    process.env.NEXT_PUBLIC_TENANT_ID === "koutalidis"
  );
}

export const metadata = {
  title: "Lawgic",
  description: "Lawbot",
};

export default function LawbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isKoutalidis = isKoutalidisTenant();

  if (isKoutalidis) {
    return (
      <FocusModeProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <KoutalidisHeader />
          <div className="flex flex-1 overflow-hidden">
            <KoutalidisSidebar />
            {/* Chat history panel */}
            <div className="w-[300px] border-r border-gray-100 bg-white flex flex-col shrink-0">
              <div className="px-3 py-3 border-b border-gray-100">
                <CreateNewChat variant="outline" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <Suspense fallback={<ChatHistoryLoader />}>
                  <ChatHistory />
                </Suspense>
              </div>
            </div>
            {/* Main content */}
            <main className="flex-1 flex flex-col overflow-hidden">
              <BreadcrumbBar toolName="Νομική Έρευνα" />
              <div className="flex-1 overflow-y-auto">{children}</div>
            </main>
          </div>
        </div>
      </FocusModeProvider>
    );
  }

  return (
    <div className="flex flex-col md:flex-row w-full">
      <div className="hidden md:block w-[15%] md:w-[20%] h-[93svh] border-r border-slate-100 bg-slate-50 py-4 overflow-y-hidden">
        <div className="px-2 pb-4">
          <CreateNewChat variant="outline" />
        </div>

        <Suspense fallback={<ChatHistoryLoader />}>
          <ChatHistory />
        </Suspense>
      </div>
      <div className="md:hidden">
        <LawbotMobileTopNav />
      </div>
      <div className="w-full md:w-[85%] ">{children}</div>
    </div>
  );
}
