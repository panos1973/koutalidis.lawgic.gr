import MessageHistoryLoader from '@/components/chat/messages/message_loader'
import { Suspense } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import Tool2MessageHistory from '@/components/tool-2/messages/tool_2_messages_history'

export const maxDuration = 60
const Tool2Page = ({ params }: { params: { id: string } }) => {
  noStore()
  return (
    <div className="flex">
      <div className="w-full">
        <Suspense fallback={<MessageHistoryLoader />}>
          <Tool2MessageHistory id={params.id} />
        </Suspense>
      </div>
    </div>
  )
}

export default Tool2Page
