'use client'

import Link from 'next/link'
import { LogoMark } from '@/components/ui/LogoMark'

const menuItems = [
  { label: 'Study', href: '/study' },
  { label: 'Search', href: '/search' },
  { label: 'Q&A', href: '/answers' },
  { label: 'Topics', href: '/topics' },
  { label: 'Community', href: '/community' },
  { label: 'Contact', href: '/contact' },
]

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-sec)] hover:bg-[var(--surface-alt)] transition-all"
      aria-label="Open menu"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  )
}

export function MobileMenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <Link href="/" onClick={onClose} className="flex items-center gap-2.5 font-serif text-lg font-bold text-[var(--primary)]">
            <LogoMark size={24} />
            Torah
          </Link>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-sec)] hover:bg-[var(--surface-alt)] transition-all"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="block px-4 py-3 rounded-lg text-sm font-medium text-[var(--text-sec)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] transition-all"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
