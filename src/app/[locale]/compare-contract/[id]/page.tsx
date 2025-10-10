import MessageHistoryLoader from "@/components/chat/messages/message_loader";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import ContractComparisonMessagesHistory from "@/components/contract-comparison/messages/contract_comparison_messages_history";

export const maxDuration = 60;

const ContractComparisonPage = ({ params }: { params: { id: string } }) => {
  noStore();
  return (
    <div className="flex">
      <div className="w-full">
        <Suspense fallback={<MessageHistoryLoader />}>
          <ContractComparisonMessagesHistory id={params.id} />
        </Suspense>
      </div>
    </div>
  );
};

export default ContractComparisonPage;
