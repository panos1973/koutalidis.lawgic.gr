import { auth } from '@clerk/nextjs/server'
import { unstable_noStore as noStore } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import {
  getTool2Chat,
  getTool2ChatsHistory,
} from '@/app/[locale]/actions/tool_2_actions'
import Tool2Links from './tool_2_links'

const Tool2History = async () => {
  noStore()
  const { userId } = auth()
  const tool2Chat = await getTool2ChatsHistory(userId!)
  const translations = await getTranslations('tool2.home')
  const tool2Translations = {
    note: translations('note'),
    selectResearchForChatHistory: translations('selectResearchForChatHistory'),
    history: translations('researches'),
    massDelete: translations('massDelete'),
    cancel: translations('cancel'),
    accept: translations('accept'),
    deleteConfirmation: translations('deleteConfirmation'),
    deleteToastSuccess: translations('deleteToastSuccess'),
    deleteToastLoading: translations('deleteToastLoading'),
    massDeleteToastSuccess: translations('massDeleteToastSuccess'),
    massDeleteToastLoading: translations('massDeleteToastLoading'),
  }
  return (
    <div className="overflow-y-scroll max-h-[83svh] no-scrollbar ">
      {!tool2Chat.length && (
        <p className="text-sm text-center mt-4">{translations('create')}</p>
      )}
      <Tool2Links
        tool2={tool2Chat}
        tool2Translations={tool2Translations}
      />
    </div>
  )
}

export default Tool2History
