import Chat from "@/components/chat/chat";
import MessageHistoryLoader from "@/components/chat/messages/message_loader";
import MessageHistory from "@/components/chat/messages/messages_history";
import { NextPage } from "next";
import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { getToolFilesByChatId } from "@/app/[locale]/actions/misc_actions";
import { ToolFile } from "@/lib/types/types";

const ChatPage = async ({ params }: { params: { id: string } }) => {
  noStore();
  
  // Fetch tool files for this chat
  const toolFilesResult = await getToolFilesByChatId(params.id);
  const toolFiles: ToolFile[] = toolFilesResult.success && toolFilesResult.data ? toolFilesResult.data.filter(file => file.toolName === 'lawbot') : [];
  
  return (
    <div>
      <Suspense fallback={<MessageHistoryLoader />}>
        <MessageHistory id={params.id} toolFiles={toolFiles} />
      </Suspense>
    </div>
  );
};

export default ChatPage;
