"use client";

import { NextPage } from "next";
import { Button } from "../ui/button";
import { Add, FolderAdd } from "iconsax-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Icons } from "../icons";
import { useTranslations } from "next-intl";
import { createLibraryFolder } from "@/app/[locale]/actions/library_actions";
import { useUser } from "@clerk/nextjs";

interface Props {
  parentFolderId?: string;
}

const NewLibraryFolder: NextPage<Props> = ({ parentFolderId }) => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("library");

  const createFolder = async () => {
    if (!folderName) return;

    setLoading(true);
    toast.promise(createLibraryFolder(folderName, user?.id!), {
      loading: "Creating folder...",
      success: () => {
        setLoading(false);
        setFolderName("");
        setIsOpen(false);
        return "Folder created successfully";
      },
      error: (error) => {
        setLoading(false);
        return error.message;
      },
    });
  };

  return (
    <div className="col-span-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="text-xs" size="sm">
            <FolderAdd size={18} className="mr-2" />
            {t("createFolder")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-1">
              <h4 className="font-medium leading-none">{t("createFolder")}</h4>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-4">
                <Input
                  id="width"
                  placeholder="New Folder"
                  className="col-span-2 h-8 text-sm"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
                <Button
                  disabled={loading}
                  onClick={createFolder}
                  variant="outline"
                  size="sm"
                >
                  {loading ? (
                    <Icons.spinner className="animate-spin w-4 h-4" />
                  ) : (
                    t("create")
                  )}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default NewLibraryFolder;
