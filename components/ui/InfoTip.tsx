'use client'

import { useEffect, useRef, useState } from 'react'

/** A small ⓘ button that explains something. Opens on hover (desktop) and on tap (phones); closes on outside tap or Esc. */
export function InfoTip({ text, label = 'More info', className = '' }: { text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="w-5 h-5 inline-flex items-center justify-center rounded-full text-[var(--text-sec)] hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-light)]">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </button>
      {open && (
        <span role="tooltip"
          className="absolute top-full start-0 mt-1 z-30 w-64 rounded-lg bg-[var(--text)] text-white text-xs font-normal leading-relaxed px-3 py-2 shadow-lg text-start">
          {text}
        </span>
      )}
    </span>
  )
}
