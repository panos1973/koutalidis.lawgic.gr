import { NextPage } from 'next'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '../ui/button'
import { Suspense } from 'react'
import ChatHistoryLoader from '../chat/chat_history_loader'
import DocumentCreationMessageHistory from './messages/document_creation_messages_history'
import CreateNewDocumentCreation from './create_new_document_creation'
import DocumentCreationHistory from './document_creation_history'
import { useTranslations } from 'use-intl'
import { getTranslations } from 'next-intl/server'
import { CloseCircle } from 'iconsax-react' // Import the close icon
import { auth } from '@clerk/nextjs/server'
import { unstable_noStore as noStore } from 'next/cache'
import { getDocumentCreations } from '@/app/[locale]/actions/document_creation_actions'
import DocumentCreationLinks from './document_creation_links'

interface Props {}

const DocumentCreationMobileTopNav: NextPage<Props> = async () => {
  const t = await getTranslations('documentCreation.home')
  noStore()
  const { userId } = auth()
  const documentCreations = await getDocumentCreations(userId!)
  const translations = await getTranslations('documentCreation.home')
  const documentCreationTranslations = {
    selectDocumentForChatHistory: translations('selectDocumentForChatHistory'),
    history: translations('documents'),
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
    <>
      <div className="md:flex hidden w-full justify-between px-4 py-2">
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
            >
              {t('documents')}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="relative flex flex-col items-center">
              <DrawerClose asChild>
                <button className="absolute right-2 top-1 md:hidden">
                  <CloseCircle className="h-6 w-6" />
                </button>
              </DrawerClose>
              <DrawerTitle className="w-full text-center">
                {t('documents')}
              </DrawerTitle>
              <DrawerDescription>
                {t('selectDocumentForChatHistory')}
              </DrawerDescription>
            </DrawerHeader>
            <Suspense fallback={<ChatHistoryLoader />}>
              <DocumentCreationHistory />
            </Suspense>
            <DrawerFooter>
              {/* <Button>Submit</Button> */}
              {/* <DrawerClose>
              <Button variant="outline">Cancel</Button>
            </DrawerClose> */}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <CreateNewDocumentCreation />
      </div>
      <div className="md:hidden">
        <DocumentCreationLinks
          documentCreations={documentCreations}
          documentCreationTranslations={documentCreationTranslations}
        />
      </div>
    </>
  )
}

export default DocumentCreationMobileTopNav
