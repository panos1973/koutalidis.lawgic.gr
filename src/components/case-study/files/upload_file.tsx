"use client";
import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { saveCaseFile } from "@/app/[locale]/actions/case_study_actions";
import { Icons } from "@/components/icons";
import { DocumentCloud, TickCircle, Trash } from "iconsax-react";
import { NextPage } from "next";
import { useTranslations } from "use-intl";
import { useUser } from "@clerk/nextjs";
import { UsageLimitsWithCheck } from "@/lib/types/types";
import { calculatePageCount } from "@/lib/doc_utils";
import { toast } from "sonner";
import { recordFileUploadUsage } from "@/app/[locale]/actions/subscription";
import { set } from "zod";
interface Props {
  caseStudyId: string;
  subData: UsageLimitsWithCheck;
}

interface UploadedFile {
  file: File;
  uploading: boolean;
  uploaded: boolean;
  fileName: string;
}

const UploadFile: NextPage<Props> = ({ caseStudyId, subData }) => {
  const t = useTranslations("caseResearch.docs");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [allUploaded, setAllUploaded] = useState(false); // Tracks if all files have been uploaded
  const { user } = useUser();
  // Dropzone hook for handling multiple file uploads
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
      onDrop: async (acceptedFiles: File[]) => {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

        // Filter out files that exceed the maximum size
        const validFiles = acceptedFiles.filter((file) => {
          if (file.size > MAX_FILE_SIZE) {
            alert(`${file.name} exceeds the maximum file size of 10MB.`);
            return false;
          }
          return true;
        });

        const newFiles = validFiles.map((file) => ({
          file,
          uploading: true,
          uploaded: false,
          fileName: file.name,
        }));

        setUploadedFiles((prevFiles) => [...prevFiles, ...newFiles]);

        let pagesCount = 0;

        for (const file of validFiles) {
          const pageCount = await calculatePageCount(file);
          pagesCount += pageCount;
        }

        if (
          pagesCount >
            subData.uploadLimit.totalLimit - subData.uploadLimit.used ||
          subData.uploadLimit.isReached
        ) {
          toast.error(
            "Upload limit reached. Please upgrade your plan to upload more files."
          );
          setUploadedFiles([]);
          setAllUploaded(true);
          return;
        }

        validFiles.forEach(async (fl) => {
          const reader = new FileReader();
          reader.readAsDataURL(fl);
          reader.onload = async () => {
            const fileBase64 = reader.result;
            await saveCaseFile({
              caseStudyId,
              base64Source: fileBase64 as string,
              fileName: fl.name,
              fileType: fl.name.split(".")[1],
              fileSize: fl.size,
              userId: user?.id || "anonymous", // Add this line
            });
            setUploadedFiles((prevFiles) =>
              prevFiles.map((file) =>
                file.fileName === fl.name
                  ? { ...file, uploading: false, uploaded: true }
                  : file
              )
            );
          };
        });

        await recordFileUploadUsage(
          subData.subscriptionId,
          pagesCount,
          `case-research/${caseStudyId}`
        );
      },
    });

  // Check if all files are uploaded
  useEffect(() => {
    if (
      uploadedFiles.length > 0 &&
      uploadedFiles.every((file) => file.uploaded)
    ) {
      setAllUploaded(true);
      // Remove all files after 1 seconds when all are uploaded
      setTimeout(() => {
        setUploadedFiles([]);
      }, 1000);
    }
  }, [uploadedFiles]);

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
          <input {...getInputProps()} multiple />
          <div className="flex flex-col justify-center items-center h-full">
            <DocumentCloud className="block" size={20} />
            <p
              className="text-center text-xs mt-1"
              dangerouslySetInnerHTML={{
                __html: t("uploadFile", { maxFiles: 50 }),
              }}
            ></p>
            <p className="text-xs text-slate-400 mt-1 font-light">
              Max Size: 10MB
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {uploadedFiles.length > 0 ? (
          uploadedFiles.map((fileObj, index) => (
            <div
              key={index}
              className="text-xs border rounded-xl py-3 bg-zinc-100 px-4 flex justify-between font-light"
            >
              <div className="flex space-x-3 text-slate-600">
                {fileObj.uploading ? (
                  <Icons.spinner className="animate-spin h-4 w-4" />
                ) : (
                  <TickCircle className="h-4 w-4 text-green-500" />
                )}
                <p>{fileObj.uploading ? t("uploading") : "Uploaded"}</p>
              </div>
              <p className="font-medium">{fileObj.fileName}</p>
            </div>
          ))
        ) : (
          // <p className="text-center text-xs mt-4 text-slate-400">
          //   {t('noDocUploaded')}
          // </p>
          <></>
        )}
      </div>
    </div>
  );
};

export default UploadFile;

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
          <p className="text-center text-xs mt-1">{t("uploadFile")}</p>
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
      */
}
