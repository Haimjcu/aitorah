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
          AI Torah
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {['Study', 'Search', 'Community', 'Contact'].map((item) => (
            <Link
              key={item}
              href={`/${item.toLowerCase()}`}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--text-sec)] hover:text-[var(--text)] hover:bg-[var(--surface-alt)] transition-all"
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a href="https://www.sefaria.org/texts" target="_blank" rel="noopener noreferrer">
            <img src="/powered-by-sefaria.png" alt="Powered by Sefaria" className="h-8" />
          </a>
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
