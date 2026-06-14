import type { Metadata } from 'next'
import { BuildingBanner } from '@/components/ui/BuildingBanner'

export const metadata: Metadata = { title: 'Events — AI Torah' }

export default function EventsPage() {
  return (
    <div className="bg-[var(--bg)]">
      <BuildingBanner />
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-4">Events</h1>
        <p className="text-[var(--text-sec)] text-lg leading-relaxed max-w-xl mx-auto">
          Live shiurim, hackathons, and community gatherings — coming soon.
        </p>
      </div>
    </div>
  )
}
