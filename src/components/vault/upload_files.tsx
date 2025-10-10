"use client";
import { NextPage } from "next";
import { Button } from "../ui/button";
import { DocumentUpload } from "iconsax-react";
import { Label } from "../ui/label";
import { ChangeEvent, useCallback, useState } from "react";
import { uploadVaultFile } from "@/app/[locale]/actions/vault_actions";
import { PutBlobResult } from "@vercel/blob";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { UsageLimitsWithCheck } from "@/lib/types/types";
import { calculatePageCount } from "@/lib/doc_utils";
import { recordFileUploadUsage } from "@/app/[locale]/actions/subscription";
interface Props {
  folderId: string;
  subData: UsageLimitsWithCheck;
}
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

const UploadVaultFile: NextPage<Props> = ({ folderId, subData }) => {
  const locale = useLocale();
  const t = useTranslations("vault");
  const tToast = useTranslations("toast");

  const [fileUploadTracker, setFileUploadTracker] = useState({
    file: null,
    completedPercentage: 0,
    step: null,
  });
  const [uploading, setUploading] = useState(false);
  const onDrop = useCallback((acceptedFiles: any) => {
    // Do something with the files
    console.log(acceptedFiles);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [],
      "image/jpeg": [],
      "image/png": [],
      "image/jpg": [],
    },
    multiple: true,
    onDrop: (f) => handleFileUpload(f),
  });

  const handleFileUpload = async (files: File[]) => {
    // const files = e.target.files;

    if (!files || !files.length) return;

    let pagesCount = 0;

    for (const file of files) {
      const pageCount = await calculatePageCount(file);
      pagesCount += pageCount;
    }

    if (
      pagesCount > subData.uploadLimit.totalLimit - subData.uploadLimit.used ||
      subData.uploadLimit.isReached
    ) {
      toast.error(
        tToast("fileUpload.uploadLimitReached")
      );
      return;
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(tToast("fileUpload.fileTooLarge", { fileName: file.name }));
        return;
      }

      toast.promise(uploadAndProcess(file, folderId, locale), {
        loading: tToast("fileUpload.uploadingDocument", { fileName: file.name }),
        success: tToast("fileUpload.documentUploaded"),
        error: tToast("fileUpload.uploadError"),
      });
    }
    await recordFileUploadUsage(
      subData.subscriptionId,
      pagesCount,
      `vault/${folderId}`
    );
  };

  const uploadAndProcess = async (
    file: File,
    folderId: string,
    locale: string
  ) => {
    const folder = "vault";
    const response = await fetch(
      `/${locale}/api/upload_blob_vercel?folder=${folder}&filename=${file.name}`,
      {
        method: "POST",
        body: file,
      }
    );
    let newBlob = (await response.json()) as PutBlobResult;
    await uploadVaultFile(
      (newBlob as PutBlobResult).url,
      file.name,
      file.type,
      file.size,
      folderId
    );
  };

  return (
    <div className="col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-2 2xl:col-span-1">
      <Label
        {...getRootProps()}
        htmlFor="fileUploaderVault"
        className={cn(
          "w-full h-36 border-dotted border-2 rounded-xl flex flex-col space-y-1 justify-center items-center hover:bg-zinc-50 hover:cursor-pointer",
          {
            "border-green-300": isDragActive,
          }
        )}
      >
        <DocumentUpload size={24} />
        <input {...getInputProps()} />
        <p className="text-xs font-medium">
          {isDragActive ? t("dropFilesHere") : t("uploadFiles")}
        </p>
        <p className="text-xs font-light text-zinc-400">
          {t("maxSize", {
            fileSize: 10,
          })}
        </p>
      </Label>
    </div>
  );
};

export default UploadVaultFile;
