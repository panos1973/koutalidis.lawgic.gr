"use client";

import { VaultFile, VaultFolderFiles } from "@/lib/types/types";
import { NextPage } from "next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  ArrowRight,
  ArrowRight2,
  AttachCircle,
  DocumentText1,
  Folder2,
  TickCircle,
} from "iconsax-react";
import { Dispatch, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "../ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import {
  deleteContractComparisonFile,
  saveContractComparisonFile,
} from "@/app/[locale]/actions/contract_comparison_actions";

interface Props {
  vaulFolderFiles: VaultFolderFiles[];
  selectedFiles: VaultFile[];
  setSelectedFiles: Dispatch<React.SetStateAction<VaultFile[]>>;
  contractIndex: number;
  comparisonId: string;
}

const ContractCompareVaultFileSelector: NextPage<Props> = ({
  vaulFolderFiles,
  selectedFiles,
  setSelectedFiles,
  contractIndex,
  comparisonId,
}) => {
  //   const [selectedFiles, setSelectedFiles] = useState<VaultFile[]>(inFiles);
  const locale = useLocale();
  const t = useTranslations("vault");
  const t2 = useTranslations("tool2.chat");
  const toggleFileSelection = async (file: VaultFile) => {
    let isAlreadySelected = false;
    console.log(isAlreadySelected);

    setSelectedFiles((prev) => {
      isAlreadySelected = prev.some(
        (selectedFile) => selectedFile.id === file.id
      );
      if (isAlreadySelected) {
        return prev.filter((selectedFile) => selectedFile.id !== file.id); // Remove if already selected
      } else if (!isAlreadySelected && prev.length >= 2) {
        return prev;
      } else {
        return [...prev, file];
      }
    });

    if (isAlreadySelected) {
      await removeContractFile(file);
    } else {
      await addContractFile(file);
    }
  };

  const addContractFile = async (file: VaultFile) => {
    await saveContractComparisonFile({
      fileId: file.id,
      comparisonId: comparisonId,
      fileContent: "",
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: Number(file.fileSize),
      storageUrl: file.storageUrl,
      vaultFileId: file.id,
    });
  };

  const removeContractFile = async (file: VaultFile) => {
    await deleteContractComparisonFile(file.id, comparisonId);
  };

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="hover:cursor-pointer flex space-x-2"
          asChild
        >
          <div className="border px-4 py-3 items-center flex space-x-2 rounded-lg hover:cursor-pointer hover:bg-zinc-100 ">
            <DocumentText1 size={18} color="#555555" variant="Bulk" />
            <p className="text-xs font-medium text-center">
              {t2("contract")} {contractIndex === 1 ? "A" : "B"}
            </p>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[14rem] max-w-[24rem]">
          <DropdownMenuLabel>{t("selectFileFromVault")}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {vaulFolderFiles.length > 0 &&
              vaulFolderFiles.map((folder) => (
                <DropdownMenuSub key={folder.id}>
                  <DropdownMenuSubTrigger className="flex items-center w-full">
                    <Folder2 variant="Bulk" size={14} />
                    <p className="text-xs ml-2 truncate">
                      {folder.folderName}
                    </p>
                    <small className=" ml-1 text-zinc-400 whitespace-nowrap">
                      ({folder.vaultFiles.length} files)
                    </small>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="min-w-[220px] max-w-[380px]">
                      {folder.vaultFiles.map((file) => (
                        <DropdownMenuItem
                          key={file.id}
                          className="text-xs hover:cursor-pointer flex w-full justify-between items-center"
                          onClick={() => toggleFileSelection(file)}
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {file.fileName.length > 25
                                  ? file.fileName.substring(0, 25) + "..."
                                  : file.fileName}
                              </TooltipTrigger>
                              <TooltipContent className="bg-zinc-900 text-white text-xs w-[200px]">
                                <p>{file.fileName}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {selectedFiles.some(
                            (selectedFile) => selectedFile.id === file.id
                          ) && (
                            <TickCircle
                              size={16}
                              color="#37d67a"
                              variant="Bulk"
                              className="ml-2"
                            />
                          )}
                        </DropdownMenuItem>
                      ))}

                      {!folder.vaultFiles.length && (
                        <DropdownMenuItem className="text-xs">
                          No files found
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ))}
            {vaulFolderFiles.length === 0 && (
              <div className="p-2">
                <p className="text-xs">{t("noFilesUploaded")}</p>
                <hr className="bg-zinc-200 my-1" />
                <Button
                  size="sm"
                  variant="link"
                  className="text-wrap p-0 text-left space-x-2"
                >
                  <Link href={`/${locale}/vault`}>{t("goToVault")}</Link>
                  <ArrowRight size={18} />
                </Button>
              </div>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ContractCompareVaultFileSelector;
