import type { Metadata } from "next";
import { Suspense } from "react";
import ChatHistoryLoader from "@/components/chat/chat_history_loader";
import { getTranslations } from "next-intl/server";
import CreateNewContractComparison from "@/components/contract-comparison/create_new_comparison";
import ContractComparisonHistory from "@/components/contract-comparison/contract_comparison_history";
import ContractComparisonMobileTopNav from "@/components/contract-comparison/mobile_top_nav";

export const metadata: Metadata = {
  title: "Lawgic | Contract Comparison",
  description: "Contract Comparison",
};

export default function ContractComparisonLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col md:flex-row w-full">
      <div className="hidden md:block w-[15%] md:w-[20%] border-r border-slate-100 h-[93svh] bg-slate-50 py-4 overflow-y-hidden">
        <div className="px-2 pb-4">
          <CreateNewContractComparison variant="outline" />
        </div>
        <Suspense fallback={<ChatHistoryLoader />}>
          <ContractComparisonHistory />
        </Suspense>
      </div>
      <div className="md:hidden">
        <ContractComparisonMobileTopNav />
      </div>
      <div className="w-full md:w-[85%]">{children}</div>
    </div>
  );
}
