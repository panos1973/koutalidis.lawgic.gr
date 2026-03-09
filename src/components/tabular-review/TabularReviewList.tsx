'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '@clerk/nextjs'
import { Plus, Table2, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createTabularReview,
  deleteTabularReview,
} from '@/app/[locale]/actions/tabular_review_actions'

interface Review {
  id: string
  title: string
  description: string | null
  status: string | null
  createdAt: Date | null
  updatedAt: Date | null
}

export function TabularReviewList({ reviews }: { reviews: Review[] }) {
  const router = useRouter()
  const locale = useLocale()
  const { userId } = useAuth()
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!userId) return
    setCreating(true)
    try {
      const reviewId = await createTabularReview(userId)
      router.push(`/${locale}/tabular-review/${reviewId}`)
    } catch (error) {
      console.error('Error creating review:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, reviewId: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this review?')) return
    setDeletingId(reviewId)
    try {
      await deleteTabularReview(reviewId)
      router.refresh()
    } catch (error) {
      console.error('Error deleting review:', error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tabular Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            {locale === 'el'
              ? 'Εξάγετε δεδομένα από πολλά έγγραφα σε δομημένο πίνακα με AI'
              : 'Extract data from multiple documents into a structured table with AI'}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="bg-[#c5032a] hover:bg-[#a50223]">
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {locale === 'el' ? 'Νέα Αναθεώρηση' : 'New Review'}
        </Button>
      </div>

      {/* Empty state */}
      {reviews.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Table2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {locale === 'el' ? 'Δεν υπάρχουν αναθεωρήσεις' : 'No reviews yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            {locale === 'el'
              ? 'Δημιουργήστε μια νέα tabular review για να εξάγετε δεδομένα από πολλά έγγραφα ταυτόχρονα.'
              : 'Create a new tabular review to extract data from multiple documents simultaneously.'}
          </p>
          <Button onClick={handleCreate} disabled={creating} variant="outline">
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {locale === 'el' ? 'Δημιουργία' : 'Create Review'}
          </Button>
        </div>
      )}

      {/* Review list */}
      {reviews.length > 0 && (
        <div className="space-y-2">
          {reviews.map((review) => (
            <div
              key={review.id}
              onClick={() => router.push(`/${locale}/tabular-review/${review.id}`)}
              className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Table2 className="h-5 w-5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {review.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {review.createdAt
                      ? new Date(review.createdAt).toLocaleDateString(
                          locale === 'el' ? 'el-GR' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' }
                        )
                      : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, review.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 transition-all"
                disabled={deletingId === review.id}
              >
                {deletingId === review.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : (
                  <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
