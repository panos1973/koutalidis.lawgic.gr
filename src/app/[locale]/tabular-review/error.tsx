'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'

export default function TabularReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    console.error('Tabular Review error:', error)
  }, [error])

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        {locale === 'el'
          ? 'Κάτι πήγε στραβά'
          : 'Something went wrong'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {locale === 'el'
          ? 'Παρουσιάστηκε σφάλμα κατά τη φόρτωση. Παρακαλώ δοκιμάστε ξανά.'
          : 'An error occurred while loading. Please try again.'}
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={() => reset()}>
          {locale === 'el' ? 'Δοκιμάστε ξανά' : 'Try again'}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/${locale}/tabular-review`)}
        >
          {locale === 'el' ? 'Πίσω στη λίστα' : 'Back to list'}
        </Button>
      </div>
    </div>
  )
}
