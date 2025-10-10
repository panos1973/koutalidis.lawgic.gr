import { NextPage } from "next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "../ui/button";
import ResourcesManager from "./resources_manager";

import { Document } from "iconsax-react";

interface Props {
  tool2Id: string;
  files: [];
}

const ResourcesMobile: NextPage<Props> = ({ tool2Id, files }) => {
  return (
    <div>
      <Drawer>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="space-x-2 rounded-full"
          >
            <Document size={16} />
            {/* <p>Documents</p> */}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Manage Your Documents</DrawerTitle>
            <DrawerDescription>Upload or Remove Resources</DrawerDescription>
          </DrawerHeader>
          <ResourcesManager
            tool2Id={tool2Id}
            files={files}
            selectedFile={null}
            searchText={undefined}
            onCloseFile={function (): void {
              throw new Error("Function not implemented.");
            }}
          />
          <DrawerFooter>
            {/* <Button>Submit</Button> */}
            {/* <DrawerClose>
              <Button variant="outline">Cancel</Button>
            </DrawerClose> */}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ResourcesMobile;
