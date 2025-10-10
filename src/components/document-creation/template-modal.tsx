'use client'

import { NextPage } from 'next'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DocumentText1, TickCircle } from 'iconsax-react'
import { templates } from '@/lib/documentCreationTemplateUtils'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  onTemplateSelect: (templateKey: string) => void
  triggerButton?: React.ReactNode
}

const TemplateModal: NextPage<Props> = ({
  onTemplateSelect,
  triggerButton,
}) => {
  const [open, setOpen] = useState(false)
  const locale = useLocale()
  const t = useTranslations('documentCreation.chat')
  const templateKeys = Object.keys(templates)

  const defaultTrigger = (
    <Button
      size="sm"
      variant="outline"
      className="space-x-2 bg-transparent rounded-full px-2 py-0"
    >
      <DocumentText1 size="18" />
      <p>{t('templates')}</p>
    </Button>
  )

  return (
    <div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogTrigger asChild>{triggerButton || defaultTrigger}</DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('selectATemplate')}</DialogTitle>
            <DialogDescription>{t('selectTempalteSubTitle')}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {templateKeys.map((templateKey) => {
              const template = templates[templateKey as keyof typeof templates]
              return (
                <Card
                  key={templateKey}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
                  onClick={() => {
                    onTemplateSelect(templateKey)
                    setOpen(false)
                  }}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <DocumentText1
                        size="20"
                        className="text-primary"
                        variant="Bold"
                      />
                      <h3 className="font-medium text-sm">
                        {locale === 'el'
                          ? template.title_greek
                          : template.title}
                      </h3>
                    </div>

                    {/* <p className="text-xs text-muted-foreground">
                         { locale === "el" ? template. : template.description}
                      </p> */}

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">
                        Click to select
                      </span>
                      <TickCircle
                        size="16"
                        className="text-green-500"
                      />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Total: {templateKeys.length} templates available
            </p>
          </div> */}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TemplateModal
