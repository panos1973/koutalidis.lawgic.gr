import { NextPage } from "next";
import { getLibraryFolderFiles } from "../../actions/library_actions";
import { Folder2 } from "iconsax-react";
import GoBackButton from "@/components/misc/go_back";
import { getLocale, getTranslations } from "next-intl/server";
import { getGreekGregoryDate } from "@/lib/utils";
import { checkUsageLimits } from "../../actions/subscription";
import UpdateFolderName from "@/components/library/edit_folder_name";
import UploadLibraryFile from "@/components/library/upload_files";
import FileIconRenderer from "@/components/library/file_icons_renderer";
import FilePreview from "@/components/library/file_previews";
import LibraryFileManager from "@/components/library/file_manager";
import { LibraryFile } from "@/lib/types/types";

interface Props {}

const LibraryFolderFilesManager = async ({
  params,
}: {
  params: { id: string };
}) => {
  const locale = (await getLocale()) ?? "el";
  const t = await getTranslations("library");
  const folderData = await getLibraryFolderFiles(params.id);
  const subscriptionData = await checkUsageLimits();

  return (
    <div className="px-12">
      <div className=" w-[70%] h-[90%]">
        <div className=" py-6">
          <GoBackButton title={t("library")} />

          <div className="flex space-x-2 mt-3 items-center">
            <Folder2 variant="Bulk" size={24} color="#555555" />

            <h1 className="text-xl font-bold">{folderData?.folderName}</h1>
            <UpdateFolderName
              folderId={params.id}
              currentName={folderData?.folderName || ""}
            />
          </div>
          <h6 className="text-sm font-light">{t("manageFiles")} </h6>
        </div>

        <LibraryFileManager
          folderId={params.id}
          files={(folderData?.libraryFiles as LibraryFile[]) || []}
          subscriptionData={subscriptionData}
          locale={locale}
        />
      </div>
    </div>
  );
};

export default LibraryFolderFilesManager;
