import DocumentCreationMessageHistory from '@/components/document-creation/messages/document_creation_messages_history'
import MessageHistoryLoader from '@/components/chat/messages/message_loader'
import { getToolFilesByChatId } from '@/app/[locale]/actions/misc_actions'
import { ToolFile } from '@/lib/types/types'
import { Suspense } from 'react'
import { unstable_noStore as noStore } from 'next/cache'

export const maxDuration = 60

const DocumentCreationPage = async ({ params }: { params: { id: string } }) => {
  noStore()

  // Fetch tool files for this document creation chat
  const toolFilesResult = await getToolFilesByChatId(params.id)
  const toolFiles: any = toolFilesResult.success
    ? toolFilesResult.data || []
    : []

  return (
    <div className="flex">
      <div className="w-full">
        <Suspense fallback={<MessageHistoryLoader />}>
          <DocumentCreationMessageHistory
            id={params.id}
            toolFiles={toolFiles}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default DocumentCreationPage
