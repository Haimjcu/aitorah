import type { Metadata } from 'next'
import { BuildingBanner } from '@/components/ui/BuildingBanner'

export const metadata: Metadata = { title: 'Sign In — AI Torah' }

export default function SignInPage() {
  return (
    <div className="bg-[var(--bg)]">
      <BuildingBanner />
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="font-serif text-3xl font-bold mb-4">Sign In</h1>
        <p className="text-[var(--text-sec)] leading-relaxed">
          Accounts are not yet available. Sign up on the contact page to be notified when we launch.
        </p>
      </div>
    </div>
  )
}
