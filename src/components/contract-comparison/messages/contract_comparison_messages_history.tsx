import { unstable_noStore as noStore } from "next/cache";
import ContractComparisonChat from "../contract_comparison_chat";
import {
  getContractComparison,
  getContractComparisonFiles,
  getContractComparisonMessages,
} from "@/app/[locale]/actions/contract_comparison_actions";
import { auth } from "@clerk/nextjs/server";
import { checkUsageLimits } from "@/app/[locale]/actions/subscription";
import {
  Contract,
  ContractComparisonFile,
  VaultFile,
  VaultFolderFiles,
} from "@/lib/types/types";
import { Message } from "ai";
import {
  getAllFaultFolderFiles,
  getVaultFolders,
} from "@/app/[locale]/actions/vault_actions";

const ContractComparisonMessagesHistory = async ({ id }: { id: string }) => {
  noStore();

  const { userId, sessionClaims } = auth();

  const comparisonFiles = await getContractComparisonFiles(id);
  const comparisonMessages = await getContractComparisonMessages(id);
  const subscriptionData = await checkUsageLimits();
  //@ts-ignore
  const organizationId = sessionClaims?.o?.id!;
  const vaultFolderFiles = await getVaultFolders(userId!, organizationId);

  const contractFiles = (await getContractComparisonFiles(id)) ?? [];

  const selectedVaultFiles = vaultFolderFiles
    .map((folder) => {
      // Create a new folder object with only the selected files
      return {
        ...folder,
        vaultFiles: folder.vaultFiles.filter((file) =>
          contractFiles.some(
            (contractFile) => contractFile.vaultFileId === file.id
          )
        ),
      };
    })
    .flatMap((folder) => folder.vaultFiles);

  return (
    <div>
      <ContractComparisonChat
        comparisonId={id}
        files={comparisonFiles as ContractComparisonFile[]}
        prevMessages={comparisonMessages as Message[]}
        subscriptionData={subscriptionData}
        vaultFolderFiles={vaultFolderFiles as VaultFolderFiles[]}
        contractFiles={selectedVaultFiles as VaultFile[]}
      />
    </div>
  );
};

export default ContractComparisonMessagesHistory;
