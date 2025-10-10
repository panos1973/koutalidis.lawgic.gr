import { NextPage } from 'next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Document, TickCircle } from 'iconsax-react'
import UploadFile from './upload_file'
import { CaseStudyFile } from '@/lib/types/types'

interface Props {
  tool2Id: string
  files: CaseStudyFile[]
}

const FileManagerModal: NextPage<Props> = ({ tool2Id, files }) => {
  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="space-x-2 bg-transparent rounded-full"
          >
            <p>Upload</p>
            <Document size="16" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Your Tool 2 Files</DialogTitle>
            <DialogDescription>
              This where you can manage your tool 2 files.
            </DialogDescription>
          </DialogHeader>
          <UploadFile tool2Id={tool2Id} />
          <div className="mt-">
            <p className="text-sm mb-3 font-medium">Uploaded Documents</p>
            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-row justify-between items-center text-xs mb-2"
              >
                <p>{file.file_name}</p>

                <div className="flex space-x-2 items-center">
                  <p>{file.file_type}</p>

                  <TickCircle
                    size="18"
                    color="#37d67a"
                    variant="Bulk"
                  />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default FileManagerModal
