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
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { toast } from "sonner";
import { creatVaultFolder } from "@/app/[locale]/actions/vault_actions";
import { Icons } from "../icons";
import { useTranslations } from "next-intl";
interface Props {}

const CreateNewFolder: NextPage<Props> = () => {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("vault");

  const createFolder = async () => {
    if (!folderName || !userId) return;

    setLoading(true);
    toast.promise(creatVaultFolder(folderName, userId), {
      success: (data) => {
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
    <div className="col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-2 2xl:col-span-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="text-sm flex-col space-y-2 space-x-2 w-full h-36 rounded-xl bg-gradient-to-r from-zinc-50 via-zinc-200 to-zinc-50"
          >
            <FolderAdd size={26} />
            <p className="text-xs">{t("createFolder")}</p>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-1">
              <h4 className="font-medium leading-none">{t("createFolder")}</h4>
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
                    "Create"
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

export default CreateNewFolder;
