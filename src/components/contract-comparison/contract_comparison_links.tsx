'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Trash } from 'iconsax-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// import { deleteContractComparison } from "@/app/[locale]/actions/contract_comparison_actions";
import HistoryHeader from '../misc/history_header'
import { useLocale } from 'next-intl'
import { deleteContractComparison } from '@/app/[locale]/actions/contract_comparison_actions'

interface Props {
  comparisons: any[]
  comparisonTranslations: {
    history: string
    massDelete: string
    cancel: string
    accept: string
    deleteConfirmation: string
    deleteToastSuccess: string
    deleteToastLoading: string
    massDeleteToastSuccess: string
    massDeleteToastLoading: string
  }
}

const ContractComparisonLinks = ({
  comparisons,
  comparisonTranslations,
}: Props) => {
  const path = usePathname()
  const [selectedComparisons, setSelectedComparisons] = useState<string[]>([])
  const [isMassDelete, setIsMassDelete] = useState(false)
  const locale = useLocale() || 'el'

  const handleComparisonSelection = (comparisonId: string) => {
    setSelectedComparisons((prev) =>
      prev.includes(comparisonId)
        ? prev.filter((id) => id !== comparisonId)
        : [...prev, comparisonId]
    )
  }

  const handleMassDelete = async () => {
    try {
      toast.promise(
        Promise.all(
          selectedComparisons.map((comparisonId) =>
            deleteContractComparison(comparisonId)
          )
        ),
        {
          loading: `${comparisonTranslations.massDeleteToastLoading}...`,
          success: comparisonTranslations.massDeleteToastSuccess,
          error: "Oops! Couldn't Delete, try again",
        }
      )
      setSelectedComparisons([])
      setIsMassDelete(false)
    } catch {
      toast.error('Failed to delete selected comparisons, please try again.')
    }
  }

  const renderComparisonContent = (comparison: any) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-1/2">
            <p className="text-sm font-medium line-clamp-2">
              {comparison.title || 'Untitled Comparison'}
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 w-[280px]">
          <p>{comparison.title || 'Untitled Comparison'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <div>
      {comparisons.length > 0 && (
        <HistoryHeader
          selectedChats={selectedComparisons}
          handleMassDelete={handleMassDelete}
          setSelectedChats={setSelectedComparisons}
          isMassDelete={isMassDelete}
          setIsMassDelete={setIsMassDelete}
          chatHistoryTranslations={comparisonTranslations}
        />
      )}

      {comparisons.map((comparison) => (
        <div
          className={cn('h-16 py-1 hover:cursor-pointer px-2', {
            'border-r-2 border-primary bg-slate-200': path.endsWith(
              comparison.id
            ),
            'bg-red-100 border-l-4 border-red-500':
              isMassDelete && selectedComparisons.includes(comparison.id),
          })}
          key={comparison.id}
        >
          <div className="flex space-x-4 justify-between items-center w-full">
            {isMassDelete ? (
              <div
                className="w-full cursor-pointer"
                onClick={() => handleComparisonSelection(comparison.id)}
              >
                <div className="w-full">
                  {renderComparisonContent(comparison)}
                </div>
              </div>
            ) : (
              <Link
                href={`/${locale}/compare-contract/${comparison.id}`}
                className="w-full"
              >
                <div className="w-full">
                  {renderComparisonContent(comparison)}
                </div>
              </Link>
            )}

            {!isMassDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Trash
                    size={15}
                    variant="Broken"
                    className="cursor-pointer"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() => {
                      toast.promise(deleteContractComparison(comparison.id), {
                        loading: `${comparisonTranslations.deleteToastLoading}...`,
                        success: comparisonTranslations.deleteToastSuccess,
                        error: "Oops! Couldn't Delete, try again",
                      })
                    }}
                  >
                    {comparisonTranslations.deleteConfirmation}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ContractComparisonLinks
