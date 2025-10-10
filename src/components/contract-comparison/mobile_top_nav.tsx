import { NextPage } from "next";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "../ui/button";
import { Suspense } from "react";
import ChatHistoryLoader from "../chat/chat_history_loader";
import { useTranslations } from "use-intl";
import { getTranslations } from "next-intl/server";
import CreateNewContractComparison from "./create_new_comparison";
import ContractComparisonHistory from "./contract_comparison_history";
import { CloseCircle } from "iconsax-react"; // Import the close icon
import { auth } from "@clerk/nextjs/server";
import { unstable_noStore as noStore } from "next/cache";
import { getContractComparisons } from "@/app/[locale]/actions/contract_comparison_actions";

interface Props {}

const ContractComparisonMobileTopNav: NextPage<Props> = async () => {
  const t = await getTranslations("contract.home"); // Reusing contract translations for now
  noStore();
  const { userId } = auth();
  const comparisons = await getContractComparisons(userId!);
  const translations = await getTranslations("contract.home");
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
    <>
      <div className="md:flex hidden w-full justify-between px-4 py-2">
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              className="text-xs font-medium tracking-wide uppercase text-slate-600"
            >
              {t("history")}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t("history")}</DrawerTitle>
              <DrawerDescription>{t("selectChatHistory")}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <Suspense fallback={<ChatHistoryLoader />}>
                <ContractComparisonHistory />
              </Suspense>
            </div>
            <DrawerFooter className="pt-2">
              <DrawerClose asChild>
                <Button variant="outline">
                  <CloseCircle size={18} className="mr-2" />
                  {t("cancel")}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
      <div className="flex md:hidden w-full justify-between px-4 py-2">
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              className="text-xs font-medium tracking-wide uppercase text-slate-600"
            >
              {t("history")}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t("history")}</DrawerTitle>
              <DrawerDescription>{t("selectChatHistory")}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <Suspense fallback={<ChatHistoryLoader />}>
                <ContractComparisonHistory />
              </Suspense>
            </div>
            <DrawerFooter className="pt-2">
              <DrawerClose asChild>
                <Button variant="outline">
                  <CloseCircle size={18} className="mr-2" />
                  {t("cancel")}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
};

export default ContractComparisonMobileTopNav;
