import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { CorrectionsQueue } from '@/components/admin/CorrectionsQueue'
import { AppPageHeader } from '@/components/layout/AppPageHeader'

export const metadata: Metadata = { title: 'Admin — Corrections', robots: { index: false, follow: false } }

export default async function AdminCorrectionsPage() {
  const { authorized } = await isAdmin()
  if (!authorized) redirect('/study')
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title="Corrections & Learning">
        <span className="text-sm text-[var(--text-sec)]">
          <Link href="/admin" className="underline">Review queue</Link> · <Link href="/admin/skills" className="underline">Skills</Link>
        </span>
      </AppPageHeader>
      <div className="flex-1 overflow-y-auto p-7">
        <CorrectionsQueue />
      </div>
    </div>
  )
}
