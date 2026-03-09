"use client";
import { VaultFolder } from "@/lib/types/types";
import { Folder2, Share } from "iconsax-react";
import { NextPage } from "next";
import Link from "next/link";
import { Button } from "../ui/button";
import CreateNewFolder from "./new_folder";
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
  shareVaultFolder,
  unshareVaultFolder,
} from "@/app/[locale]/actions/vault_actions";
import { getGreekGregoryDate } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
interface Props {
  folders: VaultFolder[];
  organizationId?: string;
}

const VaultFolders: NextPage<Props> = ({ folders, organizationId }) => {
  const locale = useLocale() || "el";
  const t = useTranslations("vault");
  const auth = useAuth();
  const router = useRouter();
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
                {selectedFolders.length > 0
                  ? t("unselectAll")
                  : t("deleteFolders")}
              </Button>
            ))}

          {selectionEnabled && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectionEnabled(false);
                setSelectedFolders([]);
              }}
            >
              {t("cancel")}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <CreateNewFolder onFolderCreated={() => router.refresh()} />
        {folders.map((folder) => (
          <div key={folder.id} className="relative">
            {organizationId && folder.userId === auth.userId && (
              <div className="absolute top-2 right-2 z-10">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-1">
                        <Share
                          size={14}
                          color={folder.isShared ? "#4CAF50" : "#555555"}
                        />
                        <Switch
                          className="scale-75"
                          checked={folder.isShared}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              toast.promise(
                                shareVaultFolder(folder.id, organizationId),
                                {
                                  loading: t("sharingFolder"),
                                  success: t("folderShared"),
                                  error: t("sharingError"),
                                }
                              );
                            } else {
                              toast.promise(unshareVaultFolder(folder.id), {
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
              </div>
            )}
            {folder.isShared && folder.userId !== auth.userId && (
              <div className="absolute top-2 right-2 z-10">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Share size={14} color="#4CAF50" />
                    </TooltipTrigger>
                    <TooltipContent>{t("sharedWithYou")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            {selectionEnabled ? (
              <div 
                className="space-y-1 w-full h-36 px-2 border rounded-xl flex flex-col justify-center items-center hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  if (selectedFolders.includes(folder.id)) {
                    remove(folder.id);
                  } else {
                    add(folder.id);
                  }
                }}
              >
                <div className="flex items-center justify-center w-full px-2">
                  <Folder2 size={26} color="#555555" variant="Bulk" />
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <p className="text-xs font-medium text-center">
                        {folder.folderName.length > 20
                          ? folder.folderName.slice(0, 20) + "..."
                          : folder.folderName}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="w-[180px] bg-zinc-900">
                      <p className="text-xs text-center">{folder.folderName}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <p className="text-xs text-zinc-400">
                  {locale === "el"
                    ? getGreekGregoryDate(folder.createdAt!)
                    : folder.createdAt?.toDateString()}
                </p>
                <Checkbox
                  checked={selectedFolders.some((f) => f === folder.id)}
                  onCheckedChange={(e) => {
                    if (e) {
                      add(folder.id);
                    } else {
                      remove(folder.id);
                    }
                  }}
                />
              </div>
            ) : (
              <Link href={`/${locale}/vault/${folder.id}`}>
                <div className="space-y-1 w-full h-36 px-2 border rounded-xl flex flex-col justify-center items-center hover:bg-slate-50">
                <div className="flex items-center justify-center w-full px-2">
                  <Folder2 size={26} color="#555555" variant="Bulk" />
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <p className="text-xs font-medium text-center">
                        {folder.folderName.length > 20
                          ? folder.folderName.slice(0, 20) + "..."
                          : folder.folderName}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="w-[180px] bg-zinc-900">
                      <p className="text-xs text-center">{folder.folderName}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <p className="text-xs text-zinc-400">
                  {locale === "el"
                    ? getGreekGregoryDate(folder.createdAt!)
                    : folder.createdAt?.toDateString()}
                </p>
                </div>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VaultFolders;
