'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMark } from '@/components/ui/LogoMark'

const navItems = [
  { href: '/study', label: 'Study Partner', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
  { href: '/search', label: 'Torah Search', icon: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></> },
  { href: '/community', label: 'Community', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
  { href: '/contact', label: 'Contact', icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></> },
  { href: '/admin', label: 'Admin', icon: <><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z"/></> },
]

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-[220px] bg-white border-r border-[var(--border)] flex-col flex-shrink-0 overflow-y-auto">
      <Link href="/" className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border)] font-serif text-[17px] font-bold text-[var(--primary)]">
        <LogoMark size={24} />
        Torah
      </Link>
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all ${
              pathname === item.href
                ? 'bg-[#eef2ff] text-[var(--primary)]'
                : 'text-[var(--text-sec)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]'
            }`}
          >
            <NavIcon>{item.icon}</NavIcon>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
