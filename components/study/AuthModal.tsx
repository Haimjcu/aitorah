'use client'

import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'

type Props = {
  open: boolean
  onClose: () => void
  defaultTab?: 'signin' | 'signup'
}

export function AuthModal({ open, onClose, defaultTab = 'signin' }: Props) {
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTab(defaultTab)
  }, [defaultTab])

  useEffect(() => {
    if (!open) return
    setError('')
    setEmail('')
    setPassword('')
    setName('')
  }, [open, tab])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (tab === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Sign up failed')
          setLoading(false)
          return
        }
      }

      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError(tab === 'signin' ? 'Invalid email or password' : 'Account created but sign in failed. Try signing in.')
      } else {
        onClose()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    signIn('google', { callbackUrl: '/study' })
  }

  const hasGoogle = true

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          {(['signin', 'signup'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                  : 'text-[var(--text-sec)] hover:text-[var(--text)]'
              }`}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Google button */}
          {hasGoogle && (
            <>
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--surface-alt)] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs text-[var(--text-sec)]">or</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
            </>
          )}

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors"
                placeholder={tab === 'signup' ? '8+ characters' : 'Your password'}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium text-sm hover:bg-[var(--primary-light)] disabled:opacity-50 transition-all"
            >
              {loading ? 'Please wait...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
