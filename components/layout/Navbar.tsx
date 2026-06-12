'use client'

import Link from 'next/link'
import { LogoMark } from '@/components/ui/LogoMark'

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 font-serif text-xl font-bold text-[var(--primary)]">
          <LogoMark />
          AI Torah
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {['Study', 'Apps', 'Community', 'Blog', 'Events', 'Contact'].map((item) => (
            <Link
              key={item}
              href={`/${item.toLowerCase()}`}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--text-sec)] hover:text-[var(--text)] hover:bg-[var(--surface-alt)] transition-all"
            >
              {item}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/signin" className="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--text-sec)] hover:bg-[var(--surface-alt)] transition-all">
            Sign In
          </Link>
          <Link href="/signup" className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] transition-all">
            Get Started →
          </Link>
        </div>
      </div>
    </nav>
  )
}
