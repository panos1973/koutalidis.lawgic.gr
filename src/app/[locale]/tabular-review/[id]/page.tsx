import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import {
  getTabularReview,
  getTabularReviewColumns,
  getTabularReviewDocuments,
  getTabularReviewCells,
} from '@/app/[locale]/actions/tabular_review_actions'
import { TabularReviewWorkspace } from '@/components/tabular-review/TabularReviewWorkspace'

export const maxDuration = 60

export default async function TabularReviewDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const review = await getTabularReview(params.id)
  if (!review) redirect('/tabular-review')

  const [columns, documents, cells] = await Promise.all([
    getTabularReviewColumns(params.id),
    getTabularReviewDocuments(params.id),
    getTabularReviewCells(params.id),
  ])

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c5032a]" />
        </div>
      }
    >
      <TabularReviewWorkspace
        review={review}
        initialColumns={columns}
        initialDocuments={documents}
        initialCells={cells}
        userId={userId}
      />
    </Suspense>
  )
}
