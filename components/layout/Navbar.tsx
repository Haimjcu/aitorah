'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogoMark } from '@/components/ui/LogoMark'
import { MobileMenuButton, MobileMenuDrawer } from './MobileMenu'

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <MobileMenuButton onClick={() => setMobileOpen(true)} />

        <Link href="/" className="hidden md:flex items-center gap-2.5 font-serif text-xl font-bold text-[var(--primary)]">
          <LogoMark />
          Torah
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {[
          { label: 'Study', href: '/study' },
          { label: 'Search', href: '/search' },
          { label: 'Q&A', href: '/answers' },
          { label: 'Topics', href: '/topics' },
          { label: 'Community', href: '/community' },
          { label: 'Contact', href: '/contact' },
        ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--text-sec)] hover:text-[var(--text)] hover:bg-[var(--surface-alt)] transition-all"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link href="/" className="md:hidden flex items-center gap-2.5 font-serif text-xl font-bold text-[var(--primary)]">
          <LogoMark />
          AI Torah
        </Link>
      </div>

      <MobileMenuDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </nav>
  )
}
