import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { ReviewQueue } from '@/components/admin/ReviewQueue'
import { AppPageHeader } from '@/components/layout/AppPageHeader'

export const metadata: Metadata = {
  title: 'Admin — Review Queue',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const { authorized } = await isAdmin()
  if (!authorized) redirect('/study')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title="Review Queue">
        <span className="text-sm text-[var(--text-sec)]">Approve Q&amp;A pairs for publication</span>
      </AppPageHeader>
      <div className="flex-1 overflow-y-auto p-7">
        <ReviewQueue />
      </div>
    </div>
  )
}
