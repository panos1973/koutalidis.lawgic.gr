import { Skeleton } from "@/components/ui/skeleton";
import { FolderAdd, DocumentUpload } from "iconsax-react";

export default function VaultLoading() {
  return (
    <div className="flex flex-col h-[93svh] overflow-hidden">
      {/* Header section skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b">
        <div className="flex flex-col space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center space-x-2 px-4 py-2 border rounded-lg animate-pulse">
            <FolderAdd size={16} className="text-gray-400" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center space-x-2 px-4 py-2 border rounded-lg animate-pulse">
            <DocumentUpload size={16} className="text-gray-400" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Stats section skeleton */}
      <div className="px-6 py-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-32 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Folders grid skeleton */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="mb-6">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="w-8 h-8 bg-gray-300 rounded mb-2"></div>
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>

        {/* Files section skeleton */}
        <div>
          <Skeleton className="h-6 w-20 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-gray-300 rounded"></div>
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
                <div className="w-full h-24 bg-gray-200 rounded mb-2"></div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
