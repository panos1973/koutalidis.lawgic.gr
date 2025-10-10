import { NextPage } from "next";
import Chat from "../chat";
import {
  getChatFiles,
  getMessagesOfAchat,
} from "@/app/[locale]/actions/chat_actions";
import { Message } from "ai";
import { unstable_noStore as noStore } from "next/cache";
import {
  getAllFaultFolderFiles,
  getVaultFolderFiles,
  getVaultFolders,
} from "@/app/[locale]/actions/vault_actions";
import { LibraryFolderFiles, VaultFolderFiles, ToolFile } from "@/lib/types/types";
import { auth } from "@clerk/nextjs/server";
import { checkUsageLimits } from "@/app/[locale]/actions/subscription";
import {
  getAllLibraryFolderFiles,
  getLibraryFolders,
} from "@/app/[locale]/actions/library_actions";
const MessageHistory = async ({ id, toolFiles = [] }: { id: string; toolFiles?: ToolFile[] }) => {
  noStore();
  const { userId, sessionClaims } = auth();
  const data = await getMessagesOfAchat(id);
  const files: any = await getChatFiles(id);
  //@ts-ignore
  const organizationId = sessionClaims?.o?.id!;
  const vaultFolderFiles = await getVaultFolders(userId!, organizationId);
  const libFolderFiles = await getLibraryFolders(userId!, organizationId);
  const subscriptionData = await checkUsageLimits();
  // console.log(data)

  return (
    <div>
      <Chat
        chatId={id}
        prevMessages={data as Message[]}
        files={files}
        vaultFolderFiles={vaultFolderFiles as VaultFolderFiles[]}
        libFolderFiles={libFolderFiles as LibraryFolderFiles[]}
        subscriptionData={subscriptionData}
        toolFiles={toolFiles}
      />
    </div>
  );
};

export default MessageHistory;
