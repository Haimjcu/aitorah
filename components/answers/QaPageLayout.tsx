import { TopicsSidebar } from './TopicsSidebar'

interface QaPageLayoutProps {
  categoryStats: { category: string; count: number }[]
  activeCategory?: string | null
  children: React.ReactNode
}

export function QaPageLayout({ categoryStats, activeCategory, children }: QaPageLayoutProps) {
  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-12">
      <TopicsSidebar categoryStats={categoryStats} activeCategory={activeCategory} mobile />
      <div className="flex gap-8">
        <div className="hidden md:block">
          <TopicsSidebar categoryStats={categoryStats} activeCategory={activeCategory} />
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
