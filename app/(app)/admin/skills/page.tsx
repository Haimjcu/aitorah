import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { SkillEditor } from '@/components/admin/SkillEditor'
import { AppPageHeader } from '@/components/layout/AppPageHeader'

export const metadata: Metadata = {
  title: 'Admin — Skills',
  robots: { index: false, follow: false },
}

export default async function AdminSkillsPage() {
  const { authorized } = await isAdmin()
  if (!authorized) redirect('/study')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title="Agent Skills">
        <span className="text-sm text-[var(--text-sec)]">
          Versioned instructions for each topic. <Link href="/admin" className="underline">Review queue</Link> · <Link href="/admin/corrections" className="underline">Corrections</Link>
        </span>
      </AppPageHeader>
      <div className="flex-1 overflow-y-auto p-7">
        <SkillEditor />
      </div>
    </div>
  )
}
