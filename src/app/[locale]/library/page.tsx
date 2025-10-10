import { NextPage } from "next";
import { getTranslations } from "next-intl/server";
import {
  getUserFileStats,
  getLibraryFolders,
} from "../actions/library_actions";
import { auth } from "@clerk/nextjs/server";
import { LibraryFolder } from "@/lib/types/types";
import LibraryFolders from "@/components/library/folders";
import { CircularProgress } from "@/components/ui/circular-progress";
import { checkUsageLimits } from "../actions/subscription";

const MAX_STORAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB set for now

const Page = async () => {
  const t = await getTranslations("library");
  const { userId, sessionClaims } = auth();

  // Get user session to retrieve organization ID
  // const userSession = await getSession();
  //@ts-ignore
  const organizationId = sessionClaims?.o?.id!;

  // Pass organizationId to get both user's folders and shared folders
  const folders = await getLibraryFolders(userId!, organizationId);
  const stats = await getUserFileStats(userId!);
  const subscriptionData = await checkUsageLimits();

  let usedPages = 0;
  let maxPages = 0;
  let percentageUsed = 0;

  if (stats) {
    // Use page counts from subscription data instead of storage size
    usedPages = subscriptionData.uploadLimit.used;
    maxPages = subscriptionData.uploadLimit.totalLimit;
    percentageUsed = subscriptionData.uploadLimit.percentage;
  }

  return (
    <div className="px-4 md:px-12">
      <div className=" w-full md:w-[70%] h-[90%]">
        <div className=" py-6">
          <h1 className="text-xl font-bold">{t("yourLibrary")}</h1>
          <h6 className="text-sm font-light">{t("organizeYourFiles")} </h6>

          <div className="w-full border rounded-xl p-4 mt-3">
            <div className="flex w-full items-start justify-between ">
              <div>
                <p className="text-xs font-light text-zinc-500">
                  {t("pagesUploaded")}
                </p>
                <div className="flex space-x-1 items-center mt-2">
                  <p className="text-lg ">{usedPages}</p>
                  <p className="text-lg font-bold">/ {maxPages}</p>
                </div>
              </div>
              <div className="w-[50%] flex flex-col items-center">
                <CircularProgress
                  percentage={percentageUsed}
                  label={t("usage")}
                  usedValue={`${usedPages} `}
                  maxValue={`${maxPages} `}
                  size={50}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <LibraryFolders
          folders={folders as LibraryFolder[]}
          organizationId={organizationId}
        />

        {!folders.length && (
          <div className="p-4 bg-zinc-50 max-w-fit border border-zinc-100">
            {/* <p className="text-xs font-medium uppercase tracking-wider">
              {t("noFolder")}
            </p> */}
            <p className="text-xs font-light">{t("createAFolder")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
