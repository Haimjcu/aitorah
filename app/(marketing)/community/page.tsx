import { BuildingBanner } from '@/components/ui/BuildingBanner'

export default function CommunityPage() {
  return (
    <div className="bg-[var(--bg)]">
      <BuildingBanner />
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-4">Community</h1>
        <p className="text-[var(--text-sec)] text-lg leading-relaxed max-w-xl mx-auto">
          Forums, Discord, and collaborative spaces for Torah scholars and AI developers — coming soon.
        </p>
      </div>
    </div>
  )
}
