'use client'

import { cn } from '@/lib/utils'
import { useUser } from '@clerk/nextjs'
import {
  Layer,
  MenuBoard,
  FolderOpen,
  MessageText,
  Messages1,
  DocumentUpload,
  Book,
  Convertshape,
  NoteAdd,
  DocumentText,
} from 'iconsax-react'
import { NextPage } from 'next'
import { useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo } from 'react'
import { useTranslations } from 'use-intl'
import { NavUsageIndicator } from '../misc/nav-usage-indicator'
import { UsageLimitsWithCheck } from '@/lib/types/types'

// Dynamically load the user profile dropdown component
const UserProfileDropdown = dynamic(() => import('./user-profile-dropdown'), {
  ssr: false, // Disable server-side rendering for this component
  loading: () => <div>Loading...</div>, // Show a fallback while it's loading
})

interface Props {
  subscriptionData: UsageLimitsWithCheck
}

// Helper function to determine active route
const isActive = (path: string, route: string) => path.includes(route)

const SideNavbar: NextPage<Props> = ({ subscriptionData }) => {
  const path = usePathname()
  const locale = useLocale() || 'el'
  const t = useTranslations('common.mainNavs')

  const { isSignedIn } = useUser()

  if (!isSignedIn || path.includes('onboarding')) return null

  return (
    <div>
      <nav className="flex flex-col justify-between py-12 w-24 border-r border-slate-100 h-[93svh]">
        <ul className="space-y-6">
          <li
            className={cn({
              'border-r-2 border-primary': isActive(path, `/lawbot`),
            })}
          >
            <Link
              href={`/${locale}/lawbot`}
              prefetch={true}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <MessageText
                size={20}
                color="#555555"
                variant={isActive(path, `/lawbot`) ? 'Bulk' : 'Linear'}
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold': isActive(path, `/lawbot`),
                })}
              >
                {t('lawbot')}
              </p>
            </Link>
          </li>

          <li
            className={cn({
              'border-r-2 border-primary': isActive(path, `/case-research`),
            })}
          >
            <Link
              href={`/${locale}/case-research`}
              prefetch={true}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <Layer
                size={20}
                color="#555555"
                variant={isActive(path, `/case-research`) ? 'Bulk' : 'Linear'}
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold': isActive(path, `/case-research`),
                })}
              >
                {t('caseResearch')}
              </p>
            </Link>
          </li>

          <li
            className={cn({
              'border-r-2 border-primary': isActive(path, `/document-creation`),
            })}
          >
            <Link
              href={`/${locale}/document-creation`}
              prefetch={true}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <DocumentText
                size={20}
                color="#555555"
                variant={
                  isActive(path, `/document-creation`) ? 'Bulk' : 'Linear'
                }
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold': isActive(path, `/document-creation`),
                })}
              >
                {t('documentCreation')}
              </p>
            </Link>
          </li>

          {/* <li
            className={cn({
              "border-r-2 border-primary": isActive(path, `/tool-2`),
            })}
          >
            <Link
              href={`/${locale}/tool-2`}
              prefetch={true}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <Layer
                size={20}
                color="#555555"
                variant={isActive(path, `/tool-2`) ? "Bulk" : "Linear"}
              />
              <p
                className={cn("text-xs text-center", {
                  "font-semibold": isActive(path, `/tool-2`),
                })}
              >
                {t("tool2")}
              </p>
            </Link>
          </li> */}

          <li
            className={cn({
              'border-r-2 border-primary': isActive(path, `/contract`),
            })}
          >
            <Link
              href={`/${locale}/contract`}
              prefetch={true}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <MenuBoard
                size={20}
                color="#555555"
                variant={isActive(path, `/contract`) ? 'Bulk' : 'Linear'}
              />
              <div className="flex flex-col items-center">
                <p
                  className={cn('text-xs text-center', {
                    'font-semibold': isActive(path, `/contract`),
                  })}
                >
                  {t('contracts')}
                </p>
                <p
                  className={cn('text-[10px] text-center text-gray-500', {
                    'font-semibold': isActive(path, `/contract`),
                  })}
                >
                  {t('contractsSubtitle')}
                </p>
              </div>
            </Link>
          </li>

          <li
            className={cn({
              'border-r-2 border-primary': isActive(path, `/compare-contract`),
            })}
          >
            <Link
              href={`/${locale}/compare-contract`}
              prefetch={true}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <Convertshape
                size={20}
                color="#555555"
                variant={
                  isActive(path, `/compare-contract`) ? 'Bulk' : 'Linear'
                }
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold': isActive(path, `/compare-contract`),
                })}
              >
                {t('compareContracts')}
              </p>
            </Link>
          </li>

          <li
            className={cn({
              'border-r-2 border-primary': isActive(path, `/vault`),
            })}
          >
            <Link
              href={`/${locale}/vault`}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <FolderOpen
                size={20}
                color="#555555"
                variant={isActive(path, `/vault`) ? 'Bulk' : 'Linear'}
              />
              <p
                className={cn('text-xs text-center', {
                  'font-semibold': isActive(path, `/vault`),
                })}
              >
                {t('personalVault')}
              </p>
            </Link>
          </li>

          <li
            className={cn({
              'border-r-2 border-primary': isActive(path, `/library`),
            })}
          >
            <Link
              href={`/${locale}/library`}
              prefetch={true}
              className="flex flex-col justify-center items-center space-y-1"
            >
              <Book
                size={20}
                color="#555555"
                variant={isActive(path, `/library`) ? 'Bulk' : 'Linear'}
              />

              <p
                className={cn('text-xs text-center', {
                  'font-semibold': isActive(path, `/library`),
                })}
              >
                {t('library')}
              </p>
            </Link>
          </li>
        </ul>

        <div className="flex flex-col justify-center items-center space-y-4 border-t py-4">
          {/* <div className="space-y-3 border-t border-b w-full py-3">
            <p className="text-xs uppercase font-medium tracking-wide text-zinc-500 text-center">
              Usage
            </p>
            <div>
              <NavUsageIndicator
                percentage={10}
                icon={DocumentUpload}
                label="Pages"
                usage={55}
                limit={250}
              />
            </div>
            <div>
              <NavUsageIndicator
                percentage={30}
                icon={Messages1}
                label="Message"
                usage={3}
                limit={100}
              />
            </div>
          </div> */}
          {/* <div className="py-2 px-2 rounded-2xl bg-gray-100 flex flex-col items-center">
            <p className="text-xs font-medium text-zinc-500">Pages</p>
            <p className="text-sm font-medium text-zinc-900 tracking-wider ">
              44/<small>250</small>
            </p>
            <div className="h-[2px] w-[80%] bg-gray-300 mt-2 rounded-full"></div>
            <p className="text-xs font-medium text-zinc-500 mt-2">Messages</p>
            <p className="text-sm font-medium text-zinc-900 tracking-wider ">
              33/<small>100</small>
            </p>
          </div> */}
          <div className="w-full px-4">
            <p className="text-xs font-medium text-zinc-500">Messages</p>
            <p className="text-sm font-medium text-zinc-900 tracking-wider ">
              {subscriptionData.messageLimit.used}/
              <small>{subscriptionData.messageLimit.totalLimit}</small>
            </p>
          </div>
          <div className="w-full px-4">
            <p className="text-xs font-medium text-zinc-500">Pages</p>
            <p className="text-sm font-medium text-zinc-900 tracking-wider ">
              {subscriptionData.uploadLimit.used}/
              <small>{subscriptionData.uploadLimit.totalLimit}</small>
            </p>
          </div>

          <UserProfileDropdown />
        </div>
      </nav>
    </div>
  )
}

export default memo(SideNavbar)
