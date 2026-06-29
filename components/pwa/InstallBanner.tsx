'use client'

import { useState, useEffect } from 'react'
import { usePwaInstall } from '@/lib/usePwaInstall'

const DELAY_MS = 60_000

export function InstallBanner() {
  const { canInstall, isIosDevice, wasDismissed, install, dismiss } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)

  useEffect(() => {
    if (!canInstall || wasDismissed) return
    const timer = setTimeout(() => setVisible(true), DELAY_MS)
    return () => clearTimeout(timer)
  }, [canInstall, wasDismissed])

  if (!visible) return null

  const handleInstall = async () => {
    if (isIosDevice) {
      setShowIosGuide(true)
      return
    }
    await install()
    dismiss()
    setVisible(false)
  }

  const handleDismiss = () => {
    dismiss()
    setVisible(false)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-[380px] z-50 animate-slide-up">
      <div className="bg-[var(--primary)] text-white rounded-xl shadow-lg p-4">
        {showIosGuide ? (
          <div>
            <p className="text-sm font-medium mb-2">Install AI Torah</p>
            <p className="text-xs text-white/80 leading-relaxed">
              Tap the <span className="inline-block align-middle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </span> Share button, then select <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
            </p>
            <button
              onClick={handleDismiss}
              className="mt-3 text-xs text-white/60 hover:text-white transition-colors"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">Install AI Torah</p>
              <p className="text-xs text-white/70 mt-0.5">Get the app for quick Torah study</p>
            </div>
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-white text-[var(--primary)] text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors flex-shrink-0"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-white/50 hover:text-white transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
