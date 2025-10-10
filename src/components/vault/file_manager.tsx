"use client";

import { useState } from "react";
import { VaultFile } from "@/lib/types/types";
import { NextPage } from "next";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DocumentDownload, FolderOpen, Trash } from "iconsax-react";
import UploadVaultFile from "./upload_files";
import FilePreview from "./file_previews";
import FileIconRenderer from "./file_icons_renderer";
import { getGreekGregoryDate } from "@/lib/utils";
import {
  moveVaultFiles,
  downloadVaultFile,
  deleteVaultFiles,
  getVaultFolders,
} from "@/app/[locale]/actions/vault_actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

interface Props {
  folderId: string;
  files: VaultFile[];
  subscriptionData: any;
  locale: string;
}

const VaultFileManager: NextPage<Props> = ({
  folderId,
  files,
  subscriptionData,
  locale,
}) => {
  const t = useTranslations("vault");
  const { user } = useUser();
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string>("");
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFolders = async () => {
      if (user?.id) {
        const folderData = await getVaultFolders(user.id);
        setFolders(folderData || []);
      }
    };
    fetchFolders();
  }, [user?.id]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map((file) => file.id));
    }
  };

  const handleMoveFiles = async () => {
    if (!targetFolderId || selectedFiles.length === 0) {
      toast.error("Please select files and target folder");
      return;
    }

    setLoading(true);
    try {
      await moveVaultFiles(selectedFiles, targetFolderId);
      toast.success(`${selectedFiles.length} files moved successfully`);
      setSelectedFiles([]);
      setMoveDialogOpen(false);
      setSelectionMode(false);
    } catch (error) {
      toast.error("Failed to move files");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to download");
      return;
    }

    try {
      for (const fileId of selectedFiles) {
        const fileData = await downloadVaultFile(fileId);
        if (fileData?.success && fileData?.fileUrl) {
          const link = document.createElement("a");
          link.href = fileData.fileUrl;
          link.download = fileData.fileName || "download";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
      toast.success(`${selectedFiles.length} files downloaded`);
      setSelectedFiles([]);
      setSelectionMode(false);
    } catch (error) {
      toast.error("Failed to download files");
    }
  };

  const handleDeleteFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to delete");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedFiles.length} files? This action cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await deleteVaultFiles(selectedFiles);
      toast.success(`${selectedFiles.length} files deleted successfully`);
      setSelectedFiles([]);
      setSelectionMode(false);
    } catch (error) {
      toast.error("Failed to delete files");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-light">{t("files")}</h3>
          <p className="text-xs font-light text-zinc-400">
            ({files.length} {t("files")})
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {files.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedFiles([]);
              }}
            >
              {selectionMode ? "Cancel" : "Select Files"}
            </Button>
          )}

          {selectionMode && (
            <>
              <Button variant="outline" size="sm" onClick={selectAllFiles}>
                {selectedFiles.length === files.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>

              {selectedFiles.length > 0 && (
                <div className="flex space-x-2">
                  <Dialog
                    open={moveDialogOpen}
                    onOpenChange={setMoveDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FolderOpen size={16} className="mr-1" />
                        Move ({selectedFiles.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Move Files</DialogTitle>
                        <DialogDescription>
                          Select the destination folder for{" "}
                          {selectedFiles.length} selected files.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Select
                          value={targetFolderId}
                          onValueChange={setTargetFolderId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination folder" />
                          </SelectTrigger>
                          <SelectContent>
                            {folders
                              .filter((folder) => folder.id !== folderId)
                              .map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.folderName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setMoveDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleMoveFiles}
                            disabled={loading || !targetFolderId}
                          >
                            {loading ? "Moving..." : "Move Files"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadFiles}
                  >
                    <DocumentDownload size={16} className="mr-1" />
                    Download ({selectedFiles.length})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteFiles}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash size={16} className="mr-1" />
                    Delete ({selectedFiles.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <UploadVaultFile folderId={folderId} subData={subscriptionData} />
        {files.map((file) => (
          <div
            key={file.id}
            className={`relative flex flex-col justify-center items-center h-36 px-2 py-4 border rounded-xl hover:bg-slate-50 transition-colors ${
              selectedFiles.includes(file.id)
                ? "ring-2 ring-blue-500 bg-blue-50"
                : ""
            } ${
              selectionMode ? "cursor-pointer" : ""
            }`}
            onClick={selectionMode ? () => toggleFileSelection(file.id) : undefined}
          >
            {selectionMode && (
              <div className="absolute top-2 left-2 z-10">
                <Checkbox
                  checked={selectedFiles.includes(file.id)}
                  onCheckedChange={() => toggleFileSelection(file.id)}
                  className="bg-white shadow-sm"
                />
              </div>
            )}

            <div className="w-8 h-8">
              <FileIconRenderer fileType={file.fileType} />
            </div>

            <FilePreview
              fileUrl={file.storageUrl}
              fileName={file.fileName}
              fileType={file.fileType}
              selectionMode={selectionMode}
            />

            <p className="text-xs text-zinc-400 mt-2">
              {locale === "el"
                ? getGreekGregoryDate(file.createdAt!)
                : file.createdAt?.toDateString()}
            </p>

            {!selectionMode && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const fileData = await downloadVaultFile(file.id);
                      if (fileData?.success && fileData?.fileUrl) {
                        const link = document.createElement("a");
                        link.href = fileData.fileUrl;
                        link.download = fileData.fileName || "download";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success("File downloaded");
                      }
                    } catch (error) {
                      toast.error("Failed to download file");
                    }
                  }}
                  className="h-6 w-6 p-0"
                >
                  <DocumentDownload size={12} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {files.length === 0 && (
        <div className="p-4 bg-zinc-50 max-w-fit border border-zinc-100">
          <p className="text-xs font-medium tracking-wider">
            {t("noFilesUploaded")}
          </p>
        </div>
      )}
    </div>
  );
};

export default VaultFileManager;
