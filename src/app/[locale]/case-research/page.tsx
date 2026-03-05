import CreateNewCaseStudy from "@/components/case-study/create_new_case_study";

import { ArrowLeft, ArrowUp } from "iconsax-react";
import { NextPage } from "next";
import { useLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

const Page = async ({ params }: { params: { lang: string } }) => {
  const t = await getTranslations("caseResearch.home");

  return (
    <div className="flex justify-center items-center h-[83svh] md:h-[93svh]">
      <div className="mx-4 md:w-[50%]">
        <div className="flex flex-col justify-center items-center w-full h-full max-h-[60svh] md:max-h-[80svh]  overflow-y-scroll no-scrollbar -mt-[10svh] md:mt-0">
          <div className="border rounded-xl  w-full   overflow-x-auto ">
            <p
              className="font-medium text-sm text-center py-4 px-8 border-b font-sans"
              dangerouslySetInnerHTML={{ __html: t.raw("welcome") }}
            ></p>
            <div className="flex h-full items-center overflow-x-auto overflow-y-hidden no-scrollbar">
              <div className="px-4 py-2 border-l">
                <p
                  className="text-xs font-sans"
                  dangerouslySetInnerHTML={{ __html: t.raw("message") }}
                ></p>
              </div>
            </div>
            <p className="text-xs text-slate-700 px-4 py-2 border-t font-light text-center font-sans">
              {t("continueMessage")}
            </p>
          </div>
          <div className="border rounded-xl mt-4">
            <div className="flex items-center justify-center w-full space-x-4 px-4 md:px-8">
              <div className="border-r min-h-full w-full py-3 pr-1 pl-2">
                <p className="font-medium text-xs font-sans">
                  {t("selectChat")}
                </p>
              </div>
              <div className="w-[40%]">
                <CreateNewCaseStudy variant="outline" />
              </div>
            </div>
            {/* <div className="mx-8 my-2 hidden md:flex items-center space-x-2 ">
            <ArrowLeft />
            <div className="text-xs text-slate-700 font-light">
              {" "}
              Select One{" "}
            </div>
          </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
