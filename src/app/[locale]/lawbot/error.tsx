'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

export default function LawbotError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useLocale()

  useEffect(() => {
    console.error('Lawbot error:', error)
  }, [error])

  const isGreek = locale === 'el'

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {isGreek ? 'Κάτι πήγε στραβά' : 'Something went wrong'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {isGreek
            ? 'Παρουσιάστηκε σφάλμα. Παρακαλώ δοκιμάστε ξανά.'
            : 'An error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium text-white bg-[#c5032a] hover:bg-[#a5021f] rounded-lg transition-colors"
        >
          {isGreek ? 'Δοκιμάστε ξανά' : 'Try again'}
        </button>
      </div>
    </div>
  )
}
