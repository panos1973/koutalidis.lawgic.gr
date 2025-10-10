import { NextPage } from "next";
import { getVaultFolderFiles } from "../../actions/vault_actions";
import { ArrowLeft, Folder2 } from "iconsax-react";
import UploadVaultFile from "@/components/vault/upload_files";
import FilePreview from "@/components/vault/file_previews";
import FileIconRenderer from "@/components/vault/file_icons_renderer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import GoBackButton from "@/components/misc/go_back";
import { getLocale, getTranslations } from "next-intl/server";
import { getGreekGregoryDate } from "@/lib/utils";
import UpdateFolderName from "@/components/vault/edit_folder_name";
import { checkUsageLimits } from "../../actions/subscription";
import VaultFileManager from "@/components/vault/file_manager";
import { VaultFile } from "@/lib/types/types";
interface Props {}

const VaultFolderFilesManager = async ({
  params,
}: {
  params: { id: string };
}) => {
  const locale = (await getLocale()) ?? "el";
  const t = await getTranslations("vault");
  const folderData = await getVaultFolderFiles(params.id);
  const subscriptionData = await checkUsageLimits();
  //   console.log(folderData);

  return (
    <div className="px-12">
      <div className=" w-[70%] h-[90%]">
        <div className=" py-6">
          <GoBackButton title={t("vault")} />

          <div className="flex space-x-2 mt-3">
            <Folder2 variant="Bulk" size={24} color="#555555" />

            <h1 className="text-xl font-bold">{folderData?.folderName}</h1>
            <UpdateFolderName
              folderId={folderData?.id!}
              currentName={folderData?.folderName!}
            />
          </div>
          <h6 className="text-sm font-light">{t("manageFiles")} </h6>
        </div>

        <VaultFileManager
          folderId={params.id}
          files={(folderData?.vaultFiles as VaultFile[]) || []}
          subscriptionData={subscriptionData}
          locale={locale}
        />
      </div>
    </div>
  );
};

export default VaultFolderFilesManager;
