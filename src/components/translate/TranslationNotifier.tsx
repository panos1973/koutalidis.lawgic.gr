'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

const POLL_INTERVAL_MS = 5000
const STORAGE_KEY = 'activeTranslationJobId'

const messages = {
  el: {
    ready: 'Η μετάφρασή σας είναι έτοιμη!',
    failed: 'Η μετάφραση απέτυχε.',
    view: 'Προβολή',
  },
  en: {
    ready: 'Your translation is ready!',
    failed: 'Translation failed.',
    view: 'View',
  },
}

/**
 * Global component that monitors active translation jobs from any page.
 * When a job completes (or fails), it shows a toast notification.
 * Must be placed in a layout that wraps all pages.
 */
export function TranslationNotifier() {
  const locale = useLocale() as 'el' | 'en'
  const pathname = usePathname()
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const t = messages[locale] || messages.en

  useEffect(() => {
    // Don't poll if we're already on the translate page (it has its own polling)
    const isOnTranslatePage = pathname?.includes('/translate')

    function startPolling() {
      const jobId = localStorage.getItem(STORAGE_KEY)
      if (!jobId || isOnTranslatePage) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return
      }

      if (intervalRef.current) return // Already polling

      intervalRef.current = setInterval(async () => {
        const currentJobId = localStorage.getItem(STORAGE_KEY)
        if (!currentJobId) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return
        }

        try {
          const res = await fetch(
            `/${locale}/api/translate/job-status/${currentJobId}`,
          )
          if (!res.ok) return

          const data = await res.json()

          if (data.status === 'completed') {
            localStorage.removeItem(STORAGE_KEY)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }

            toast.success(t.ready, {
              duration: 10000,
              action: {
                label: t.view,
                onClick: () => router.push(`/${locale}/translate`),
              },
            })
          } else if (data.status === 'failed') {
            localStorage.removeItem(STORAGE_KEY)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }

            toast.error(
              data.errorMessage || t.failed,
              { duration: 8000 },
            )
          }
        } catch {
          // Network error — keep polling
        }
      }, POLL_INTERVAL_MS)
    }

    startPolling()

    // Listen for storage changes (e.g., job started on translate page)
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        startPolling()
      }
    }

    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [locale, pathname, router, t])

  return null // This component renders nothing — it only manages the polling + toast
}
