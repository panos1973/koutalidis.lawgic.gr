import { auth } from '@clerk/nextjs/server'
import { unstable_noStore as noStore } from 'next/cache'

import DocumentCreationLinks from './document_creation_links'
import { getDocumentCreations } from '@/app/[locale]/actions/document_creation_actions'
import { getTranslations } from 'next-intl/server'

const DocumentCreationHistory = async () => {
  noStore()
  const { userId } = auth()
  const documentCreationsResult = await getDocumentCreations(userId!)
  const documentCreations = documentCreationsResult || []

  const translations = await getTranslations('documentCreation.home')

  const documentCreationTranslations = {
    note: translations('note'),
    selectDocumentForChatHistory: translations('selectDocumentForChatHistory'),
    history: translations('history'),
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
      {!documentCreations.length && (
        <p className="text-sm text-center mt-4">{translations('create')}</p>
      )}
      <DocumentCreationLinks
        documentCreations={documentCreations}
        documentCreationTranslations={documentCreationTranslations}
      />
    </div>
  )
}

export default DocumentCreationHistory
