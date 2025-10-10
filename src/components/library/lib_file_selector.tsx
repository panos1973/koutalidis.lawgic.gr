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
  ArrowRight,
  FolderOpen,
  Folder,
  TickCircle,
  Book,
} from "iconsax-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dispatch, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "../ui/button";
import { SquareLibrary } from "lucide-react";

interface Props {
  libFolderFiles: LibraryFolderFiles[];
  selectedFiles: VaultFile[];
  setSelectedFiles: Dispatch<React.SetStateAction<LibraryFile[]>>;
}

const LibraryFileSelector: NextPage<Props> = ({
  libFolderFiles,
  selectedFiles,
  setSelectedFiles,
}) => {
  //   const [selectedFiles, setSelectedFiles] = useState<VaultFile[]>(inFiles);
  const locale = useLocale();
  const t = useTranslations("library");
  const toggleFileSelection = (file: VaultFile) => {
    setSelectedFiles((prev) => {
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
        <DropdownMenuTrigger asChild>
          {/* <PlusCircledIcon
            color="#555555"
            className="h-6 w-6"
          /> */}
          <Button
            size="sm"
            variant={"outline"}
            className="rounded-full space-x-2"
          >
            {/* <FolderOpen color="#555555" size={18} /> */}
            <SquareLibrary color="#555555" size={18} />
            <p className="">{t("library")}</p>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[14rem] max-w-[24rem]">
          <DropdownMenuLabel>{t("selectFileFromVault")}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {libFolderFiles.length > 0 &&
              libFolderFiles.map((folder) => (
                <DropdownMenuSub key={folder.id}>
                  <DropdownMenuSubTrigger className="flex items-center w-full">
                    <Folder variant="Bulk" size={14} />
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
                          onClick={(e) => {
                            e.preventDefault();
                            toggleFileSelection(file);
                          }}
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex items-center space-x-2 w-full">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex-1 text-left">
                                  {file.fileName.length > 25
                                    ? file.fileName.substring(0, 25) + "..."
                                    : file.fileName}
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-900 text-white text-xs w-[200px]">
                                  <p>{file.fileName}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Checkbox
                              checked={selectedFiles.some(
                                (selectedFile) => selectedFile.id === file.id
                              )}
                              onCheckedChange={() => toggleFileSelection(file)}
                            />
                          </div>
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
            {libFolderFiles.length === 0 && (
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

export default LibraryFileSelector;
