import type { Metadata } from 'next'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { AppPageHeader } from '@/components/layout/AppPageHeader'
import { getServerI18n } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Settings', robots: { index: false, follow: false } }

/** Only same-site paths, so ?next= cannot send users to another site. */
const safeNext = (v: string | string[] | undefined) =>
  typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : null

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getServerI18n()
  const sp = await searchParams
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title={t('settings.title')} />
      <div className="flex-1 overflow-y-auto p-7">
        <ProfileSettings welcome={sp.welcome === '1'} next={safeNext(sp.next)} />
      </div>
    </div>
  )
}
