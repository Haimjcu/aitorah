import type { Metadata } from 'next'
import { ProjectsList } from '@/components/projects/ProjectsList'
import { AppPageHeader } from '@/components/layout/AppPageHeader'
import { getServerI18n } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Study Projects', robots: { index: false, follow: false } }

export default async function ProjectsPage() {
  const { t } = await getServerI18n()
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title={t('projects.title')}>
        <span className="text-sm text-[var(--text-sec)]">{t('projects.subtitle')}</span>
      </AppPageHeader>
      <div className="flex-1 overflow-y-auto p-7">
        <ProjectsList />
      </div>
    </div>
  )
}
