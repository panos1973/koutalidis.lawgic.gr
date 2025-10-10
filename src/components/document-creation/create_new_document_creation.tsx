'use client'
import { NextPage } from 'next'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { Icons } from '../icons'
import { useTranslations } from 'next-intl'

interface Props {
  variant?: string
}

const CreateNewDocumentCreation: NextPage<Props> = ({ variant }) => {
  const auth = useAuth()
  const t = useTranslations('documentCreation.home')

  const [loading, setLoading] = useState<boolean>(false)

  const newDocument = async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    try {
      // Correct dynamic import for functions
      const { createDocumentCreation } = await import(
        '@/app/[locale]/actions/document_creation_actions'
      )
      await createDocumentCreation(auth.userId!)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="md:w-full w-fit "
              variant={variant as any}
              size="sm"
              onClick={newDocument}
              disabled={loading} // Disable button when loading
            >
              {loading ? (
                <Icons.spinner className="animate-spin w-4 h-4" />
              ) : (
                <>
                  <div className="md:hidden">{t('newMobile')}</div>

                  <div className="hidden md:block">{t('new')}</div>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('new')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

export default CreateNewDocumentCreation
