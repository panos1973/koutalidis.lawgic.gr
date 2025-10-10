/* eslint-disable @next/next/no-img-element */
// import CreateNewContractComparison from "@/components/contract-comparison/create_new_comparison";
import CreateNewContractComparison from "@/components/contract-comparison/create_new_comparison";
import { ArrowLeft, ArrowUp } from "iconsax-react";
import { getTranslations } from "next-intl/server";

const Page = async () => {
  const t = await getTranslations("contract.home"); // Reusing contract translations for now
  return (
    <div className="flex justify-center items-center h-[83svh] md:h-[93svh]">
      <div className="mx-4 md:w-[50%]">
        <div className="flex flex-col justify-center items-center w-full h-full max-h-[60svh] md:max-h-[80svh] overflow-y-scroll no-scrollbar -mt-[10svh] md:mt-0">
          <div className="border rounded-xl w-full overflow-x-auto">
            <p
              className="font-medium text-sm md:text-base py-4 px-8 border-b text-center"
              dangerouslySetInnerHTML={{ __html: t.raw("welcome") }}
            ></p>
            <div className="flex h-full items-center overflow-x-auto overflow-y-hidden no-scrollbar">
              <div className="px-4 py-2 border-l">
                <p className="text-xs md:text-sm">{t("message")}</p>
              </div>
            </div>
            <p className="text-xs text-slate-700 px-4 py-2 border-t font-light text-center">
              {t("continueMessage")}
            </p>
          </div>
          <div className="border rounded-xl mt-4">
            <div className="flex items-center justify-center space-x-4 w-full pr-4 pl-4">
              <div className="border-r min-h-full w-full py-3 pr-1">
                <p className="font-medium text-xs md:text-sm">{t("create")}</p>
              </div>
              <div className="w-[40%]">
                <CreateNewContractComparison variant="outline" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
