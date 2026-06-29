'use client'

import { useState } from 'react'
import { usePwaInstall } from '@/lib/usePwaInstall'

export function InstallButton() {
  const { canInstall, isIosDevice, install, dismiss } = usePwaInstall()
  const [showIosGuide, setShowIosGuide] = useState(false)

  if (!canInstall) return null

  const handleClick = async () => {
    if (isIosDevice) {
      setShowIosGuide((v) => !v)
      return
    }
    await install()
    dismiss()
  }

  return (
    <div className="md:hidden">
      <button
        onClick={handleClick}
        className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Install App
      </button>
      {showIosGuide && (
        <p className="text-xs text-white/40 mt-1.5 leading-relaxed max-w-[240px]">
          Tap the <span className="inline-block align-middle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </span> Share button, then &ldquo;Add to Home Screen&rdquo;.
        </p>
      )}
    </div>
  )
}
