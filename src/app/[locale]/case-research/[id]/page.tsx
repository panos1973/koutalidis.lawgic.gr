import CaseMessageHistory from "@/components/case-study/messages/case_messages_history";
import MessageHistoryLoader from "@/components/chat/messages/message_loader";
import { getToolFilesByChatId } from "@/app/[locale]/actions/misc_actions";
import { ToolFile } from "@/lib/types/types";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";

export const maxDuration = 60;

const CasePage = async ({ params }: { params: { id: string } }) => {
  noStore();
  
  // Fetch tool files for this case research chat
  const toolFilesResult = await getToolFilesByChatId(params.id);
  const toolFiles: ToolFile[] = toolFilesResult.success ? toolFilesResult.data || [] : [];
  
  return (
    <div className="flex">
      <div className="w-full">
        <Suspense fallback={<MessageHistoryLoader />}>
          <CaseMessageHistory id={params.id} toolFiles={toolFiles} />
        </Suspense>
      </div>
    </div>
  );
};

export default CasePage;
