import type { Metadata } from 'next'
import { ProfileSettings } from '@/components/settings/ProfileSettings'
import { AppPageHeader } from '@/components/layout/AppPageHeader'
import { getServerI18n } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Settings', robots: { index: false, follow: false } }

export default async function SettingsPage() {
  const { t } = await getServerI18n()
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title={t('settings.title')} />
      <div className="flex-1 overflow-y-auto p-7">
        <ProfileSettings />
      </div>
    </div>
  )
}
