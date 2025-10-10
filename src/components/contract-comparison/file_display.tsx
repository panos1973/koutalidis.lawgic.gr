"use client";

import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteContractComparisonFile } from "@/app/[locale]/actions/contract_comparison_actions";

interface FileDisplayProps {
  file: {
    id: string;
    file_name: string;
    file_type: string;
    storageUrl: string;
    contract_comparison_id: string;
  };
}

const ComparisonFileDisplay = ({ file }: FileDisplayProps) => {
  const handleRemoveFile = async () => {
    if (
      confirm("Are you sure you want to remove this file from the comparison?")
    ) {
      try {
        await deleteContractComparisonFile(
          file.id,
          file.contract_comparison_id
        );
        window.location.reload(); // Refresh to update UI
      } catch (error) {
        console.error("Error removing file:", error);
      }
    }
  };

  return (
    <div className="border rounded-lg p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleRemoveFile}
      >
        <X size={14} />
      </Button>

      <div className="flex flex-col items-center justify-center pt-4">
        <FileText size={40} className="text-primary mb-2" />
        <h3 className="font-medium text-sm text-center">{file.file_name}</h3>
        <p className="text-xs text-muted-foreground">
          {file.file_type.toUpperCase()}
        </p>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="mt-4">
              Preview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{file.file_name}</DialogTitle>
              <DialogDescription>
                Preview of the selected contract
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 h-[70vh] overflow-auto">
              <iframe
                src={file.storageUrl}
                className="w-full h-full border rounded"
                title={file.file_name}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ComparisonFileDisplay;
