import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getTabularReviews } from '@/app/[locale]/actions/tabular_review_actions'
import { TabularReviewList } from '@/components/tabular-review/TabularReviewList'

export const maxDuration = 60

export default async function TabularReviewPage() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const reviews = await getTabularReviews(userId)

  return <TabularReviewList reviews={reviews} />
}
