"use client";
import { NextPage } from "next";
import { Button } from "../ui/button";
import { DocumentUpload } from "iconsax-react";
import { Label } from "../ui/label";
import { useCallback, useState } from "react";
import { uploadLibraryFile } from "@/app/[locale]/actions/library_actions";
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

const UploadLibraryFile: NextPage<Props> = ({ folderId, subData }) => {
  const locale = useLocale();
  const t = useTranslations("library");
  const tToast = useTranslations("toast");
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: any) => {
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
      "text/plain": [],
      "text/csv": [],
    },
    multiple: true,
    onDrop: (f) => handleFileUpload(f),
  });

  const handleFileUpload = async (files: File[]) => {
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
        continue;
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
      `library/${folderId}`
    );
  };

  const uploadAndProcess = async (
    file: File,
    folderId: string,
    locale: string
  ) => {
    setUploading(true);
    const folder = "library";
    try {
      const response = await fetch(
        `/${locale}/api/upload_blob_vercel?folder=${folder}&filename=${file.name}`,
        {
          method: "POST",
          body: file,
        }
      );
      let newBlob = (await response.json()) as PutBlobResult;
      await uploadLibraryFile(
        (newBlob as PutBlobResult).url,
        file.name,
        file.type,
        file.size,
        folderId
      );
      setUploading(false);
      return true;
    } catch (error) {
      setUploading(false);
      console.error("Error uploading file:", error);
      throw error;
    }
  };

  return (
    <div className="col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-2 2xl:col-span-1">
      <Label
        {...getRootProps()}
        htmlFor="fileUploaderLibrary"
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

export default UploadLibraryFile;
