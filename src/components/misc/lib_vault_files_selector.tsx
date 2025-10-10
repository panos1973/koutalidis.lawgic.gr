"use client";

import {
  LibraryFile,
  LibraryFolderFiles,
  VaultFile,
  VaultFolderFiles,
} from "@/lib/types/types";
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
  AddCircle,
  AddSquare,
  ArrowRight,
  ArrowRight2,
  AttachCircle,
  Book,
  Folder2,
  Paperclip2,
  TickCircle,
} from "iconsax-react";
import { Dispatch, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "../ui/button";

interface Props {
  vaulFolderFiles: VaultFolderFiles[];
  libraryFolderFiles: LibraryFolderFiles[];
  selectedVaultFiles: VaultFile[];
  setSelectedVaultFiles: Dispatch<React.SetStateAction<VaultFile[]>>;
  selectedLibFiles: LibraryFile[];
  setSelectedLibFiles: Dispatch<React.SetStateAction<LibraryFile[]>>;
}

const LibraryAndVaultFilesSelector: NextPage<Props> = ({
  vaulFolderFiles,
  selectedVaultFiles,
  setSelectedVaultFiles,
  selectedLibFiles,
  setSelectedLibFiles,
  libraryFolderFiles,
}) => {
  //   const [selectedFiles, setSelectedFiles] = useState<VaultFile[]>(inFiles);
  const locale = useLocale();
  const t = useTranslations("vault");
  const tLib = useTranslations("library");
  
  const toggleVaultFileSelection = (file: VaultFile) => {
    setSelectedVaultFiles((prev) => {
      const isAlreadySelected = prev.some(
        (selectedFile) => selectedFile.id === file.id
      );
      return isAlreadySelected
        ? prev.filter((selectedFile) => selectedFile.id !== file.id) // Remove if already selected
        : [...prev, file]; // Add if not selected
    });
  };
  
  const toggleLibFileSelection = (file: LibraryFile) => {
    setSelectedLibFiles((prev) => {
      const isAlreadySelected = prev.some(
        (selectedFile) => selectedFile.id === file.id
      );
      return isAlreadySelected
        ? prev.filter((selectedFile) => selectedFile.id !== file.id) // Remove if already selected
        : [...prev, file]; // Add if not selected
    });
  };

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger className="hover:cursor-pointer flex space-x-2">
          <AddCircle color="#555555" size={22} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[14rem] max-w-[24rem]">
          <DropdownMenuLabel>{t("selectFileFromVault")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-medium text-zinc-500">
            Vault Files
          </DropdownMenuLabel>
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
                          onClick={() => toggleVaultFileSelection(file)}
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

                          {selectedVaultFiles.some(
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
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-medium text-zinc-500">
            Library Files
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {libraryFolderFiles.length > 0 &&
              libraryFolderFiles.map((folder) => (
                <DropdownMenuSub key={folder.id}>
                  <DropdownMenuSubTrigger className="flex items-center w-full">
                    <Book variant="Bulk" size={14} />
                    <p className="text-xs ml-2 truncate">
                      {folder.folderName}
                    </p>
                    <small className=" ml-1 text-zinc-400 whitespace-nowrap">
                      ({folder.libraryFiles.length} files)
                    </small>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="min-w-[220px] max-w-[380px]">
                      {folder.libraryFiles.map((file) => (
                        <DropdownMenuItem
                          key={file.id}
                          className="text-xs hover:cursor-pointer flex w-full justify-between items-center"
                          onClick={() => toggleLibFileSelection(file)}
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

                          {selectedLibFiles.some(
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

                      {!folder.libraryFiles.length && (
                        <DropdownMenuItem className="text-xs">
                          No files found
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ))}
            {libraryFolderFiles.length === 0 && (
              <div className="p-2">
                <p className="text-xs">{tLib("noFilesUploaded")}</p>
                <hr className="bg-zinc-200 my-1" />
                <Button
                  size="sm"
                  variant="link"
                  className="text-wrap p-0 text-left space-x-2"
                >
                  <Link href={`/${locale}/library`}>{tLib("goToVault")}</Link>
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

export default LibraryAndVaultFilesSelector;
