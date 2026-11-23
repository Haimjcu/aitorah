import type { Metadata } from 'next'
import Link from 'next/link'
import { ProjectDetail } from '@/components/projects/ProjectDetail'
import { AppPageHeader } from '@/components/layout/AppPageHeader'
import { getServerI18n } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Study Project', robots: { index: false, follow: false } }

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t } = await getServerI18n()
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title={t('projects.project')}>
        <Link href="/projects" className="text-sm text-[var(--text-sec)] hover:underline">{t('projects.allProjects')}</Link>
      </AppPageHeader>
      <div className="flex-1 overflow-y-auto p-7">
        <ProjectDetail id={id} />
      </div>
    </div>
  )
}
