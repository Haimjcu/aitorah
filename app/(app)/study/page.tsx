import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ChatInterface } from '@/components/study/ChatInterface'
import { AppPageHeader } from '@/components/layout/AppPageHeader'

export const metadata: Metadata = { title: 'Study Partner — AI Torah' }

export default function StudyPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title="Study Partner">
        <button className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-sec)] hover:bg-[var(--surface-alt)] transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
        <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-semibold">HL</div>
      </AppPageHeader>
      <div className="flex-1 overflow-hidden p-6">
        <Suspense>
          <ChatInterface />
        </Suspense>
      </div>
    </div>
  )
}
