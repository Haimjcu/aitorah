import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ChatInterface } from '@/components/study/ChatInterface'
import { AppPageHeader } from '@/components/layout/AppPageHeader'

export const metadata: Metadata = { title: 'Study Partner — AI Torah' }

export default function StudyPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title="Study Partner">
        <a href="https://www.sefaria.org/texts" target="_blank" rel="noopener noreferrer">
          <img src="/powered-by-sefaria.png" alt="Powered by Sefaria" className="h-8" />
        </a>
      </AppPageHeader>
      <div className="flex-1 overflow-hidden p-6">
        <Suspense>
          <ChatInterface />
        </Suspense>
      </div>
    </div>
  )
}
