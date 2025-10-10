"use client";

import { useDropzone } from "react-dropzone";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  UploadCloud,
  X,
  FileImage,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "./button";
import { Progress } from "./progress";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  value?: File | null;
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
  className?: string;
  label?: string;
  helpText?: string;
  error?: string;
}

export function FileUpload({
  onFileSelect,
  value,
  maxSize = 1024 * 1024, // 1MB default
  accept = {
    "image/jpeg": [],
    "image/png": [],
    "image/jpg": [],
  },
  className,
  label = "Upload file",
  helpText = "Drag and drop your file here, or click to browse",
  error,
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Simulate upload progress
  const simulateProgress = useCallback(() => {
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        // Create preview for image files
        const fileReader = new FileReader();
        fileReader.onload = () => {
          setPreview(fileReader.result as string);
        };
        fileReader.readAsDataURL(file);

        // Simulate upload progress
        const cleanup = simulateProgress();

        // Call the callback after "upload" completes
        setTimeout(() => {
          onFileSelect(file);
          cleanup();
        }, 1000);
      }
    },
    [onFileSelect, simulateProgress]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept,
      maxSize,
      multiple: false,
    });

  const removeFile = () => {
    setPreview(null);
    onFileSelect(null as unknown as File);
  };

  const fileRejectionError =
    fileRejections.length > 0 ? fileRejections[0].errors[0].message : null;

  const displayError = error || fileRejectionError;

  return (
    <div className={cn("space-y-2", className)}>
      {!preview && !value ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
            "hover:border-primary/50 hover:bg-muted/50",
            {
              "border-primary/50 bg-muted/50": isDragActive,
              "border-destructive/50 bg-destructive/10": displayError,
              "border-muted-foreground/25": !isDragActive && !displayError,
            }
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <UploadCloud
              className={cn(
                "h-10 w-10",
                displayError ? "text-destructive" : "text-muted-foreground"
              )}
            />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{helpText}</p>
              {displayError && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {displayError}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4">
          {isUploading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileImage className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {value?.name || "Uploading..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(uploadProgress)}% complete
                    </p>
                  </div>
                </div>
              </div>
              <Progress value={uploadProgress} className="h-1" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {preview && (
                  <div className="h-16 w-16 rounded-md overflow-hidden border">
                    <img
                      src={preview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium">
                      {value?.name || "File uploaded"}
                    </p>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {value?.size ? `${Math.round(value.size / 1024)} KB` : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeFile}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
