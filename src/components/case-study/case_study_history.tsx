import { auth } from '@clerk/nextjs/server'
import { unstable_noStore as noStore } from 'next/cache'

import CaseStudyLinks from './case_study_links'
import { getCaseStudies } from '@/app/[locale]/actions/case_study_actions'
import { getTranslations } from 'next-intl/server'

const CaseStudyHistory = async () => {
  noStore()
  const { userId } = auth()
  const caseStudies = await getCaseStudies(userId!)
  const translations = await getTranslations('caseResearch.home')
  const caseStudyTranslations = {
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
      {!caseStudies.length && (
        <p className="text-sm text-center mt-4">{translations('create')}</p>
      )}
      <CaseStudyLinks
        caseStudies={caseStudies}
        caseStudyTranslations={caseStudyTranslations}
      />
    </div>
  )
}

export default CaseStudyHistory
