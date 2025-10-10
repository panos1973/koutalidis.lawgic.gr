"use client";

import { NextPage } from "next";
import { Button } from "../ui/button";
import { Add, Edit, FolderAdd } from "iconsax-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { toast } from "sonner";
import { updateFolderName } from "@/app/[locale]/actions/vault_actions";
import { Icons } from "../icons";
import { useTranslations } from "next-intl";
interface Props {
  folderId: string;
  currentName: string;
}

const UpdateFolderName: NextPage<Props> = ({ folderId, currentName }) => {
  const [loading, setLoading] = useState(false);
  const [folderName, setFolderName] = useState(currentName);
  const t = useTranslations("vault");

  const createFolder = async () => {
    if (!folderName) return;

    setLoading(true);
    toast.promise(updateFolderName(folderId, folderName), {
      success: (data) => {
        setLoading(false);
        setFolderName("");
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
              {/* <p className="text-sm text-muted-foreground">
                {t("giveNameToFolder")}
              </p> */}
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-4">
                {/* <Label htmlFor="width">Name</Label> */}
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
                    t("update")
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-3 items-center gap-4"></div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default UpdateFolderName;
