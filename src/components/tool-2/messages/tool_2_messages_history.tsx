import Tool2Chat from '../tool_2_chat'
import { Message } from 'ai'
import { unstable_noStore as noStore } from 'next/cache'
import { getAllFaultFolderFiles } from '@/app/[locale]/actions/vault_actions'
import { auth } from '@clerk/nextjs/server'
import { VaultFolderFiles } from '@/lib/types/types'
import {
  getTool2Files,
  getTool2Messages,
} from '@/app/[locale]/actions/tool_2_actions'

const Tool2MessageHistory = async ({ id }: { id: string }) => {
  noStore()
  const user = auth()

  const msg = await getTool2Messages(id)
  const files: any = await getTool2Files(id)
  const vaultFolderFiles = await getAllFaultFolderFiles(user.userId!)

  return (
    <div>
      <Tool2Chat
        tool2Id={id}
        prevMessages={msg as Message[]}
        files={files}
        vaultFolderFiles={vaultFolderFiles as VaultFolderFiles[]}
      />
    </div>
  )
}

export default Tool2MessageHistory
