import { NextPage } from "next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  fileName: string;
  fileUrl: string;
  fileType: string;
  selectionMode?: boolean;
}

const FilePreview: NextPage<Props> = ({ fileName, fileUrl, fileType, selectionMode = false }) => {
  if (selectionMode) {
    return (
      <div className="mt-4">
        <p className="text-xs font-medium">
          {fileName.length > 20
            ? fileName.substring(0, 20) + "..."
            : fileName}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Dialog>
        <DialogTrigger asChild className="hover:cursor-pointer hover:underline">
          <p className="text-xs font-medium">
            {fileName.length > 20
              ? fileName.substring(0, 20) + "..."
              : fileName}
          </p>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fileName}</DialogTitle>
            <DialogDescription>
              <iframe
                src={fileUrl}
                className="w-full h-[70svh] text-black"
              ></iframe>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FilePreview;
