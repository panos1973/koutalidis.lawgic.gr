'use client'

import { cn } from '@/lib/utils'
import { useUser } from '@clerk/nextjs'
import { Layer, MenuBoard, MessageText } from 'iconsax-react'
import { NextPage } from 'next'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserProfileDropdown from './user-profile-dropdown'

interface Props {}

const MobileNavbar: NextPage<Props> = () => {
  const path = usePathname()
  const locale = useLocale() || 'el'
  const t = useTranslations('common.mainNavs')

  const { isSignedIn } = useUser()

  if (!isSignedIn || path.includes('onboarding')) return null

  return (
    <div>
      <nav className="flex items-center justify-between w-full border-t border-slate-100 h-[10svh] bg-white">
        <ul className="flex flex-wrap justify-between w-full px-6 text-wrap md:text-nowrap">
          <li
            className={cn('w-1/4 flex flex-col items-center', {
              'text-primary': path.includes('/lawbot'),
            })}
          >
            <Link
              href={`/${locale}/lawbot`}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <MessageText
                size={20}
                color="#555555"
                variant={path.includes('/lawbot') ? 'Bulk' : 'Linear'}
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold ': path.includes('/lawbot'),
                })}
              >
                {t('lawbot')}
              </p>
            </Link>
          </li>
          <li
            className={cn('w-1/4 flex flex-col items-center', {
              'text-primary': path.includes('/case-research'),
            })}
          >
            <Link
              href={`/${locale}/case-research`}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <Layer
                size="20"
                color="#555555"
                variant={path.includes('/case-research') ? 'Bulk' : 'Linear'}
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold text-ref': path.includes('/case-research'),
                })}
              >
                {t('caseResearch')}
              </p>
            </Link>
          </li>
          <li
            className={cn('w-1/4 flex flex-col items-center', {
              'text-primary': path.includes('/contract'),
            })}
          >
            <Link
              href={`/${locale}/contract`}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <MenuBoard
                size="20"
                color="#555555"
                variant={path.includes('/contract') ? 'Bulk' : 'Linear'}
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold': path.includes('/contract'),
                })}
              >
                {t('contracts')}
              </p>
            </Link>
          </li>
          <li className="w-1/4 flex flex-col items-center">
            <UserProfileDropdown />
          </li>
        </ul>
      </nav>
    </div>
  )
}

export default MobileNavbar
