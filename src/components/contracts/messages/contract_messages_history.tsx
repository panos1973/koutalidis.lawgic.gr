import { Message } from "ai";
import { unstable_noStore as noStore } from "next/cache";
import ContractChat from "../contract_chat";
import {
  getAcontractFile,
  getContractDrafts,
  getContracts,
  getDataFieldsOfContracts,
  getSectionsOfContract,
} from "@/app/[locale]/actions/contract_action";
import {
  Contract,
  ContractDataField,
  ContractDraft,
  ContractFile,
  ContractSection,
  ToolFile,
} from "@/lib/types/types";
import { auth } from "@clerk/nextjs/server";
import { checkUsageLimits } from "@/app/[locale]/actions/subscription";
import { getVaultFolders } from "@/app/[locale]/actions/vault_actions";
import { getLibraryFolders } from "@/app/[locale]/actions/library_actions";

const ContractMessageHistory = async ({ 
  id, 
  toolFiles 
}: { 
  id?: string;
  toolFiles: ToolFile[];
}) => {
  noStore();
  const { userId, sessionClaims } = auth();
  let contractFiles: ContractFile[] = [];
  let sections: ContractSection[] = [];
  let dataFields: ContractDataField[] = [];
  let drafts: ContractDraft[] = [];
  const subscriptionData = await checkUsageLimits();
  if (id) {
    contractFiles = (await getAcontractFile(id!)) as ContractFile[];
    sections = (await getSectionsOfContract(id!)) as ContractSection[];
    dataFields = (await getDataFieldsOfContracts(id!)) as ContractDataField[];
    drafts = (await getContractDrafts(id)) as ContractDraft[];
  }

  //@ts-ignore
  const organizationId = sessionClaims?.o?.id!;
  const vaultFolderFiles = await getVaultFolders(userId!, organizationId);
  const libFolderFiles = await getLibraryFolders(userId!, organizationId);

  return (
    <div>
      <ContractChat
        contractId={id ?? ""}
        sections={sections as ContractSection[]}
        fields={dataFields as ContractDataField[]}
        contractFiles={contractFiles as any}
        drafts={drafts}
        subscriptionData={subscriptionData}
        vaultFolderFiles={vaultFolderFiles as any}
        libFolderFiles={libFolderFiles as any}
        toolFiles={toolFiles}
      />
    </div>
  );
};

export default ContractMessageHistory;
