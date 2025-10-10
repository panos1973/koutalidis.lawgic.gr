"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  createContract,
  createSectionsOfContracts,
} from "@/app/[locale]/actions/contract_action";
import { Icons } from "@/components/icons";
import { DocumentCloud, TickCircle } from "iconsax-react";
import { NextPage } from "next";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "use-intl";
import { UsageLimitsWithCheck } from "@/lib/types/types";
import { calculatePageCount } from "@/lib/doc_utils";
import { toast } from "sonner";
import { recordFileUploadUsage } from "@/app/[locale]/actions/subscription";

interface Props {
  contractChatId: string;
  subData: UsageLimitsWithCheck;
}

interface FileUploadStatus {
  file: File;
  isUploading: boolean;
  uploaded: boolean;
}

const UploadContractFile: NextPage<Props> = ({ contractChatId, subData }) => {
  const t = useTranslations("contract.contracts");
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const auth = useAuth();
  const router = useRouter();
  const locale = useLocale() || "el";

  const handleFileUpload = async (selectedFiles: File[]) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

    // Filter files based on size
    const validFiles = selectedFiles.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} exceeds the maximum file size of 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return; // Stop if no valid files

    let pagesCount = 0;

    for (const file of validFiles) {
      const pageCount = await calculatePageCount(file);
      pagesCount += pageCount;
    }

    if (
      pagesCount > subData.uploadLimit.totalLimit - subData.uploadLimit.used ||
      subData.uploadLimit.isReached
    ) {
      toast.error(
        "Upload limit reached. Please upgrade your plan to upload more files."
      );
      setFiles([]);
      return;
    }

    let contractId = contractChatId;

    if (!contractId) {
      contractId = await createContract(auth.userId!);
    }

    const fileStatuses = validFiles.map((file) => ({
      file,
      isUploading: true,
      uploaded: false,
    }));

    setFiles((prevFiles) => [...prevFiles, ...fileStatuses]);

    const uploadPromises = validFiles.map(async (validFile) => {
      const fileBase64 = await new Promise<string | ArrayBuffer | null>(
        (resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(validFile);
        }
      );

      if (fileBase64) {
        await createSectionsOfContracts({
          userId: auth.userId!,
          contractId,
          base64Source: fileBase64 as string,
          fileName: validFile.name,
          fileType: validFile.name.split(".")[1],
          fileSize: validFile.size,
        });

        setFiles((prevFiles) =>
          prevFiles.map((f) =>
            f.file.name === validFile.name
              ? { ...f, isUploading: false, uploaded: true }
              : f
          )
        );
      }
    });

    await Promise.all(uploadPromises);
    await recordFileUploadUsage(
      subData.subscriptionId,
      pagesCount,
      `contract/${contractId}`
    );
    // router.push(`/${locale}/contract/${contractId}`);
  };

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: {
        "application/pdf": [],
        "application/msword": [],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          [],
        "image/jpeg": [],
        "image/png": [],
        "image/jpg": [],
      },
      maxFiles: 3,
      onDrop: (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
          handleFileUpload(acceptedFiles);
        }
      },
    });

  const baseClasses =
    "flex flex-col items-center justify-center py-4 border-2 border-dashed rounded-2xl transition-all cursor-pointer";
  const focusClasses = isFocused ? "border-blue-500" : "border-gray-300";
  const acceptClasses = isDragAccept ? "border-green-500" : "";
  const rejectClasses = isDragReject ? "border-red-500" : "";

  return (
    <div>
      <div className="container">
        <div
          {...getRootProps({
            className: `${baseClasses} ${focusClasses} ${acceptClasses} ${rejectClasses}`,
          })}
        >
          <input {...getInputProps()} multiple={true} />
          <div className="flex flex-col justify-center items-center h-full">
            <DocumentCloud className="block" size={20} />
            <p className="text-center text-xs mt-1">{t("uploadContracts")}</p>
            <p className="text-xs text-slate-400 mt-1 font-light">
              {t("maxSize", { fileSize: "10" })}
            </p>
          </div>
        </div>
      </div>

      {/* Show each file upload status */}
      {files.length > 0 && (
        <div className="mt-2 space-y-2">
          {files.map((fileStatus, index) => (
            <div
              key={index}
              className="text-xs border rounded-xl py-3 bg-zinc-100 px-4 flex justify-between font-light"
            >
              <div className="flex space-x-3 text-slate-600">
                {fileStatus.isUploading ? (
                  <Icons.spinner className="animate-spin h-4 w-4" />
                ) : fileStatus.uploaded ? (
                  <TickCircle size={16} color="green" />
                ) : null}
                <p>
                  {fileStatus.isUploading ? t("uploading") : t("uploaded")}...
                </p>
              </div>
              <p className="font-medium">{fileStatus.file.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadContractFile;

{
  /* Old Logic: Commented out */
}
{
  /*
      <Label
        htmlFor="file-upload"
        className="block border border-dashed py-4 rounded-2xl hover:cursor-pointer "
      >
        <div className="flex flex-col justify-center items-center h-full">
          <DocumentCloud className="block" size={20} />
          <p className="text-center text-xs mt-1">{t("uploadContracts")}</p>
          <p className="text-xs text-slate-400 mt-1 font-light">
            Max Size: 4MB
          </p>
        </div>
        <input
          type="file"
          id="file-upload"
          hidden
          accept="application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileUpload}
        />
      </Label>

      {uploading && (
        <div className="text-xs border rounded-xl py-3 bg-zinc-100 px-4 flex justify-between  mt-2 font-light">
          <div className="flex space-x-3 text-slate-600">
            <Icons.spinner className="animate-spin h-4 w-4" />
            <p>{t('uploading')}...</p>
          </div>
          <p className="font-medium">{file?.name}</p>
        </div>
      )}
      */
}
