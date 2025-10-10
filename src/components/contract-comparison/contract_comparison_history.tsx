import { auth } from "@clerk/nextjs/server";
import { unstable_noStore as noStore } from "next/cache";
// import { getContractComparisons } from "@/app/[locale]/actions/contract_comparison_actions";
import { getTranslations } from "next-intl/server";
import ContractComparisonLinks from "./contract_comparison_links";
import { getContractComparisons } from "@/app/[locale]/actions/contract_comparison_actions";
// import ContractComparisonLinks from "./contract_comparison_links";

const ContractComparisonHistory = async () => {
  noStore();
  const { userId } = auth();
  const comparisons = await getContractComparisons(userId!);
  const translations = await getTranslations("contract.home"); // Reusing contract translations for now
  const comparisonTranslations = {
    selectChatHistory: translations("selectChatHistory"),
    history: translations("history"),
    massDelete: translations("massDelete"),
    cancel: translations("cancel"),
    accept: translations("accept"),
    deleteConfirmation: translations("deleteConfirmation"),
    deleteToastSuccess: translations("deleteToastSuccess"),
    deleteToastLoading: translations("deleteToastLoading"),
    massDeleteToastSuccess: translations("massDeleteToastSuccess"),
    massDeleteToastLoading: translations("massDeleteToastLoading"),
  };

  return (
    <div className="overflow-y-scroll max-h-[83svh] no-scrollbar">
      {!comparisons.length && (
        <p className="text-sm text-center mt-4">{translations("create")}</p>
      )}
      <ContractComparisonLinks
        comparisons={comparisons}
        comparisonTranslations={comparisonTranslations}
      />
    </div>
  );
};

export default ContractComparisonHistory;
