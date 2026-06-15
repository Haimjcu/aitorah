'use client'

import { useState } from 'react'
import { MobileMenuButton, MobileMenuDrawer } from './MobileMenu'

export function AppPageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="px-4 md:px-7 py-4 border-b border-[var(--border)] bg-white flex items-center flex-shrink-0">
      <MobileMenuButton onClick={() => setMobileOpen(true)} />

      <h1 className="font-serif text-xl font-bold text-[var(--primary)] md:flex-none flex-1 text-center md:text-left">
        {title}
      </h1>

      {/* Right side content — hidden on mobile to keep title centered, spacer balances the hamburger */}
      <div className="hidden md:flex items-center gap-2 ml-auto">
        {children}
      </div>
      <div className="w-9 md:hidden" />

      <MobileMenuDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  )
}
