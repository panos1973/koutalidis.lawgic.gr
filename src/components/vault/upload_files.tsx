"use client";
import { NextPage } from "next";
import { DocumentUpload } from "iconsax-react";
import { Label } from "../ui/label";
import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { UsageLimitsWithCheck } from "@/lib/types/types";
import { useUploadContext } from "@/contexts/upload-context";
import { useRouter } from "next/navigation";

interface Props {
  folderId: string;
  subData: UsageLimitsWithCheck;
}

const UploadVaultFile: NextPage<Props> = ({ folderId, subData }) => {
  const locale = useLocale();
  const t = useTranslations("vault");
  const router = useRouter();
  const { isProcessing, uploadFiles, registerRefreshCallback } =
    useUploadContext();

  useEffect(() => {
    registerRefreshCallback(() => router.refresh());
    return () => registerRefreshCallback(null);
  }, [registerRefreshCallback, router]);

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
    disabled: isProcessing,
    onDrop: (files) =>
      uploadFiles(files, {
        folderId,
        subData,
        locale,
      }),
  });

  return (
    <div className="col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-2 2xl:col-span-1">
      <Label
        {...getRootProps()}
        htmlFor="fileUploaderVault"
        className={cn(
          "w-full h-36 border-dotted border-2 rounded-xl flex flex-col space-y-1 justify-center items-center hover:bg-zinc-50 hover:cursor-pointer",
          {
            "border-green-300": isDragActive,
            "opacity-50 cursor-not-allowed": isProcessing,
          }
        )}
      >
        <DocumentUpload size={24} />
        <input {...getInputProps()} />
        <p className="text-xs font-medium">
          {isProcessing
            ? t("uploadFiles") + "..."
            : isDragActive
              ? t("dropFilesHere")
              : t("uploadFiles")}
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
