"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { PutBlobResult } from "@vercel/blob";
import { uploadVaultFile } from "@/app/[locale]/actions/vault_actions";
import { recordFileUploadUsage } from "@/app/[locale]/actions/subscription";
import { calculatePageCount } from "@/lib/doc_utils";
import { UsageLimitsWithCheck } from "@/lib/types/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadOptions {
  folderId: string;
  subData: UsageLimitsWithCheck;
  locale: string;
}

interface UploadContextValue {
  isProcessing: boolean;
  uploadFiles: (files: File[], options: UploadOptions) => Promise<void>;
  registerRefreshCallback: (cb: (() => void) | null) => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const refreshCallbackRef = useRef<(() => void) | null>(null);

  const registerRefreshCallback = useCallback((cb: (() => void) | null) => {
    refreshCallbackRef.current = cb;
  }, []);

  const triggerRefresh = useCallback(() => {
    refreshCallbackRef.current?.();
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], options: UploadOptions) => {
      const { folderId, subData, locale } = options;

      if (!folderId) {
        toast.error("No folder selected for upload");
        return;
      }

      if (!files || !files.length) return;

      setIsProcessing(true);

      try {
        // Calculate total page count for usage tracking
        let pagesCount = 0;
        for (const file of files) {
          const pageCount = await calculatePageCount(file);
          pagesCount += pageCount;
        }

        // Check upload limits
        if (
          pagesCount >
            subData.uploadLimit.totalLimit - subData.uploadLimit.used ||
          subData.uploadLimit.isReached
        ) {
          toast.error("Upload limit reached. Please upgrade your plan.");
          return;
        }

        // Upload each file
        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`File "${file.name}" exceeds 10MB limit`);
            failCount++;
            continue;
          }

          try {
            // Upload to Vercel Blob
            const response = await fetch(
              `/${locale}/api/upload_blob_vercel?folder=vault&filename=${encodeURIComponent(file.name)}`,
              {
                method: "POST",
                body: file,
              }
            );

            if (!response.ok) {
              throw new Error(`Upload failed for ${file.name}`);
            }

            const newBlob = (await response.json()) as PutBlobResult;

            // Save to database
            await uploadVaultFile(
              newBlob.url,
              file.name,
              file.type,
              file.size,
              folderId
            );

            successCount++;
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            toast.error(`Failed to upload "${file.name}"`);
            failCount++;
          }
        }

        // Record usage
        if (successCount > 0) {
          await recordFileUploadUsage(
            subData.subscriptionId,
            pagesCount,
            `vault/${folderId}`
          );
          toast.success(
            successCount === 1
              ? "File uploaded successfully"
              : `${successCount} files uploaded successfully`
          );
          triggerRefresh();
        }

        if (failCount > 0 && successCount > 0) {
          toast.warning(`${failCount} file(s) failed to upload`);
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Upload failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [triggerRefresh]
  );

  return (
    <UploadContext.Provider
      value={{ isProcessing, uploadFiles, registerRefreshCallback }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUploadContext() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUploadContext must be used within an UploadProvider");
  }
  return context;
}
