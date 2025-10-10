'use client'

import { NextPage } from 'next'
import { GlobalSearch } from 'iconsax-react'
import { cn } from '@/lib/utils'

interface Props {
  isEnabled: boolean
  setIsEnabled: (enabled: boolean) => void
  className?: string
}

const InternetSearchToggle: NextPage<Props> = ({
  isEnabled,
  setIsEnabled,
  className,
}) => {
  const handleToggle = async () => {
    setIsEnabled(!isEnabled)
  }

  return (
    <button
      onClick={handleToggle}
      type="button"
      className={cn(
        'flex items-center space-x-2 p-1.5 rounded-full transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800',
        'border border-gray-200 dark:border-gray-700 hidden',
        isEnabled
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
          : 'bg-white dark:bg-gray-900',
        className
      )}
      title={isEnabled ? 'Disable Internet Search' : 'Enable Internet Search'}
      aria-label={
        isEnabled ? 'Disable Internet Search' : 'Enable Internet Search'
      }
    >
      <GlobalSearch
        size={18}
        className={cn(
          'transition-colors duration-200',
          isEnabled
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-600 dark:text-gray-400'
        )}
      />
      {/* <p className="text-xs font-medium">Internet</p> */}
    </button>
  )
}

export default InternetSearchToggle
