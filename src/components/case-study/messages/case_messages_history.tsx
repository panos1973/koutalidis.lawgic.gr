import { NextPage } from "next";
import CaseChat from "../case_chat";
import { getMessagesOfAchat } from "@/app/[locale]/actions/chat_actions";
import { Message } from "ai";
import { unstable_noStore as noStore } from "next/cache";
import {
  getCaseStudyFiles,
  getCaseStudyMessages,
} from "@/app/[locale]/actions/case_study_actions";
import {
  getAllFaultFolderFiles,
  getVaultFolders,
} from "@/app/[locale]/actions/vault_actions";
import { auth } from "@clerk/nextjs/server";
import { LibraryFolderFiles, VaultFolderFiles, ToolFile } from "@/lib/types/types";
import { checkUsageLimits } from "@/app/[locale]/actions/subscription";
import {
  getAllLibraryFolderFiles,
  getLibraryFolders,
} from "@/app/[locale]/actions/library_actions";

const CaseMessageHistory = async ({ id, toolFiles }: { id: string; toolFiles: ToolFile[] }) => {
  noStore();
  const { userId, sessionClaims } = auth();

  const msg = await getCaseStudyMessages(id);
  const files: any = await getCaseStudyFiles(id);
  //@ts-ignore
  const organizationId = sessionClaims?.o?.id!;
  const vaultFolderFiles = await getVaultFolders(userId!, organizationId);
  const libFolderFiles = await getLibraryFolders(userId!, organizationId);

  const subscriptionData = await checkUsageLimits();
  return (
    <div>
      <CaseChat
        caseId={id}
        prevMessages={msg as Message[]}
        files={files}
        vaultFolderFiles={vaultFolderFiles as VaultFolderFiles[]}
        subscriptionData={subscriptionData}
        libFolderFiles={libFolderFiles as LibraryFolderFiles[]}
        toolFiles={toolFiles}
      />
    </div>
  );
};

export default CaseMessageHistory;
