import { NextPage } from 'next'
import DocumentCreationChat from '../document_creation_chat'
import { Message } from 'ai'
import { unstable_noStore as noStore } from 'next/cache'
import {
  getDocumentCreationFiles,
  getDocumentCreationMessages,
} from '@/app/[locale]/actions/document_creation_actions'
import { getVaultFolders } from '@/app/[locale]/actions/vault_actions'
import { auth } from '@clerk/nextjs/server'
import {
  LibraryFolderFiles,
  VaultFolderFiles,
  ToolFile,
} from '@/lib/types/types'
import { checkUsageLimits } from '@/app/[locale]/actions/subscription'
import { getLibraryFolders } from '@/app/[locale]/actions/library_actions'

const DocumentCreationMessageHistory = async ({
  id,
  toolFiles,
}: {
  id: string
  toolFiles: ToolFile[]
}) => {
  noStore()
  const { userId, sessionClaims } = auth()

  // Use document creation specific functions
  const msg = await getDocumentCreationMessages(id)
  const files: any = await getDocumentCreationFiles(id)

  //@ts-ignore
  const organizationId = sessionClaims?.o?.id!
  const vaultFolderFiles = await getVaultFolders(userId!, organizationId)
  const libFolderFiles = await getLibraryFolders(userId!, organizationId)

  const subscriptionData = await checkUsageLimits()

  return (
    <div>
      <DocumentCreationChat
        documentCreationId={id} // Changed from caseId to documentCreationId
        prevMessages={msg as Message[]}
        files={files}
        vaultFolderFiles={vaultFolderFiles as VaultFolderFiles[]}
        subscriptionData={subscriptionData}
        libFolderFiles={libFolderFiles as LibraryFolderFiles[]}
        toolFiles={toolFiles}
      />
    </div>
  )
}

export default DocumentCreationMessageHistory
