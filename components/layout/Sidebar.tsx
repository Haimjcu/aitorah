'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMark } from '@/components/ui/LogoMark'

const navItems = [
  { href: '/study', label: 'Study Partner', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
  { href: '/search', label: 'Torah Search', icon: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></> },
  { href: '/community', label: 'Community', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
]

const secondaryItems = [
  { href: '/apps', label: 'App Directory', icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></> },
  { href: '/events', label: 'Events', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
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
    <aside className="w-[220px] bg-white border-r border-[var(--border)] flex flex-col flex-shrink-0 overflow-y-auto">
      <Link href="/" className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border)] font-serif text-[17px] font-bold text-[var(--primary)]">
        <LogoMark size={24} />
        AI Torah
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
        <div className="h-px bg-[var(--border)] my-2" />
        {secondaryItems.map((item) => (
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
      <div className="p-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--surface-alt)] transition-all">
          <div className="w-[30px] h-[30px] rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            HL
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Haim Lubin</div>
            <div className="text-xs text-[var(--text-sec)]">Member</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
