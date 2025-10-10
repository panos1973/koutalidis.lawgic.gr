"use client";

import { NextPage } from "next";
import { Button } from "../ui/button";
import { Edit } from "iconsax-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "../ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { updateFolderName } from "@/app/[locale]/actions/library_actions";
import { Icons } from "../icons";
import { useTranslations } from "next-intl";

interface Props {
  folderId: string;
  currentName: string;
}

const UpdateFolderName: NextPage<Props> = ({ folderId, currentName }) => {
  const [loading, setLoading] = useState(false);
  const [folderName, setFolderName] = useState(currentName);
  const t = useTranslations("library");

  const updateFolder = async () => {
    if (!folderName) return;

    setLoading(true);
    toast.promise(updateFolderName(folderId, folderName), {
      success: () => {
        setLoading(false);
        return "Folder name updated successfully";
      },
      error: (error) => {
        setLoading(false);
        return error.message;
      },
    });
  };

  return (
    <div className="col-span-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="text-sm" size="sm">
            <Edit size={18} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-1">
              <h4 className="font-medium leading-none">
                {t("editFolderName")}
              </h4>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-4">
                <Input
                  id="folderName"
                  placeholder="Folder Name"
                  className="col-span-2 h-8 text-sm"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
                <Button
                  disabled={loading}
                  onClick={updateFolder}
                  variant="outline"
                  size="sm"
                >
                  {loading ? (
                    <Icons.spinner className="animate-spin w-4 h-4" />
                  ) : (
                    t("update")
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

export default UpdateFolderName;
