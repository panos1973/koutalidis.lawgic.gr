"use client";
import { LibraryFolder } from "@/lib/types/types";
import { Folder2, Share } from "iconsax-react";
import { NextPage } from "next";
import Link from "next/link";
import { Button } from "../ui/button";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  deleteFolders,
  shareLibraryFolder,
  unshareLibraryFolder,
} from "@/app/[locale]/actions/library_actions";
import { getGreekGregoryDate } from "@/lib/utils";
import CreateNewFolder from "./new_folder";
import { useAuth } from "@clerk/nextjs";

interface Props {
  folders: LibraryFolder[];
  organizationId?: string;
}

const LibraryFolders: NextPage<Props> = ({ folders, organizationId }) => {
  const locale = useLocale() || "el";
  const t = useTranslations("library");
  const auth = useAuth();
  const [selectionEnabled, setSelectionEnabled] = useState<boolean>(false);

  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

  const add = (id: string) => {
    setSelectedFolders((prev) => [...prev, id]);
  };

  const remove = (id: string) => {
    setSelectedFolders((prev) => prev.filter((i) => i !== id));
  };

  const toggleEnableSelection = () => {
    if (selectedFolders.length > 0) {
      setSelectedFolders([]);
      return;
    }
    setSelectionEnabled(true);
  };

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between w-full mb-4 ">
        <div className="flex space-x-2 items-end">
          <h3 className="text-sm">{t("folders")}</h3>
          <p className="text-xs font-light">
            {" "}
            ({folders.length} {t("folders")})
          </p>
        </div>
        <div className="flex space-x-2">
          {selectedFolders.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm">{t("deleteSelected")}</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="font-medium text-sm">{t("confirmDelete")}</p>
                <p className="text-xs mt-2">{t("deleteCaution")}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    toast.promise(deleteFolders(selectedFolders), {
                      loading: "Deleting folders...",
                      success: () => {
                        setSelectedFolders([]);
                        setSelectionEnabled(false);
                        return "Folders deleted.";
                      },
                      error: "Something went wrong",
                    });
                  }}
                >
                  {t("confirm")}
                </Button>
              </PopoverContent>
            </Popover>
          )}
          {folders.length > 0 &&
            (selectionEnabled && selectedFolders.length === 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedFolders(folders.map((f) => f.id));
                }}
              >
                {t("selectAll")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={toggleEnableSelection}
              >
                {selectionEnabled ? t("cancel") : t("selectAll")}
              </Button>
            ))}
          <CreateNewFolder />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`relative border rounded-xl p-4 hover:bg-slate-50 transition-all ${selectionEnabled ? 'cursor-pointer' : ''}`}
            onClick={selectionEnabled ? () => {
              if (selectedFolders.includes(folder.id)) {
                remove(folder.id);
              } else {
                add(folder.id);
              }
            } : undefined}
          >
            {selectionEnabled && (
              <div className="absolute top-2 right-2">
                <Checkbox
                  checked={selectedFolders.includes(folder.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      add(folder.id);
                    } else {
                      remove(folder.id);
                    }
                  }}
                />
              </div>
            )}
            <div className="flex justify-between items-start mb-2">
              {organizationId && folder.userId === auth.userId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1">
                        <Share
                          size={16}
                          color={folder.isShared ? "#4CAF50" : "#555555"}
                        />
                        <Switch
                          className="scale-75"
                          checked={folder.isShared}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              toast.promise(
                                shareLibraryFolder(folder.id, organizationId),
                                {
                                  loading: t("sharingFolder"),
                                  success: t("folderShared"),
                                  error: t("sharingError"),
                                }
                              );
                            } else {
                              toast.promise(unshareLibraryFolder(folder.id), {
                                loading: t("unsharingFolder"),
                                success: t("folderUnshared"),
                                error: t("unsharingError"),
                              });
                            }
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {folder.isShared ? t("unshareFolder") : t("shareFolder")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {folder.isShared && folder.userId !== auth.userId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Share size={16} color="#4CAF50" />
                    </TooltipTrigger>
                    <TooltipContent>{t("sharedWithYou")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {selectionEnabled ? (
              <div className="flex space-x-2 items-center">
                <Folder2 variant="Bulk" size={20} color="#555555" />
                <p className="text-sm font-medium">{folder.folderName}</p>
              </div>
            ) : (
              <Link href={`/${locale}/library/${folder.id}`}>
                <div className="flex space-x-2 items-center">
                  <Folder2 variant="Bulk" size={20} color="#555555" />
                  <p className="text-sm font-medium">{folder.folderName}</p>
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  {locale === "el"
                    ? getGreekGregoryDate(folder.createdAt!)
                    : folder.createdAt?.toDateString()}
                </p>
              </Link>
            )}
            {selectionEnabled && (
              <p className="text-xs text-zinc-400 mt-2">
                {locale === "el"
                  ? getGreekGregoryDate(folder.createdAt!)
                  : folder.createdAt?.toDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LibraryFolders;
