import MessageHistoryLoader from "@/components/chat/messages/message_loader";
import ContractMessageHistory from "@/components/contracts/messages/contract_messages_history";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { getToolFilesByChatId } from "@/app/[locale]/actions/misc_actions";
import { ToolFile } from "@/lib/types/types";

export const maxDuration = 60;
// export const fetchCache = "force-no-store";
// export const dynamic = "force-dynamic";
const CasePage = async ({ params }: { params: { id: string } }) => {
  noStore();
  
  // Fetch tool files for this contract chat
  const toolFilesResult = await getToolFilesByChatId(params.id);
  const toolFiles: ToolFile[] = toolFilesResult.success ? 
    (toolFilesResult.data || []).filter(tf => tf.toolName === 'contract') : [];
  
  return (
    <div className="flex">
      <div className="w-full">
        <Suspense fallback={<MessageHistoryLoader />}>
          <ContractMessageHistory id={params.id} toolFiles={toolFiles} />
        </Suspense>
      </div>
    </div>
  );
};

export default CasePage;
