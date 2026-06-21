import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ChatInterface } from '@/components/study/ChatInterface'
import { AppPageHeader } from '@/components/layout/AppPageHeader'

export const metadata: Metadata = {
  title: 'Study Partner',
  description: 'Ask any Torah question and get AI-generated answers with cited sources from Tanakh, Talmud, Mishnah, and more. Powered by Sefaria and Claude.',
  alternates: { canonical: '/study' },
}

export default function StudyPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title="Study Partner" />
      <div className="flex-1 overflow-hidden p-6">
        <Suspense>
          <ChatInterface />
        </Suspense>
      </div>
    </div>
  )
}
