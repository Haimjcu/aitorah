'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { CopyButton } from '@/components/ui/CopyButton'
import { LogoMark } from '@/components/ui/LogoMark'
import { AuthModal } from './AuthModal'

type Source = { ref: string; type: string; similarity: number; hebrew: string; english: string }

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

type SessionSummary = {
  id: string
  title: string | null
  updatedAt: string
}

const HINTS = ['What are the 613 commandments?', 'Explain Shabbat laws', 'What does Genesis 1:1 mean?', 'What does the Talmud say about honesty?']

const GREETING: Message = {
  role: 'assistant',
  content: "Shalom! I'm your AI Torah study partner. Ask me anything about Torah, Talmud, Halacha, or Jewish philosophy — I'll find relevant sources and walk through them with you.",
}

function generateTitle(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > 50 ? trimmed.slice(0, 50) + '…' : trimmed
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ChatInterface() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: authSession, status: authStatus } = useSession()
  const isAuthenticated = authStatus === 'authenticated'

  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [openSources, setOpenSources] = useState<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialQuerySent = useRef(false)

  const [sessionList, setSessionList] = useState<SessionSummary[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signin')
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  currentSessionIdRef.current = currentSessionId

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Load session list when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/sessions')
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          setSessionList(Array.isArray(data) ? data : [])
        })
        .catch(() => setSessionList([]))
    } else {
      setSessionList([])
    }
  }, [isAuthenticated])

  // After first response, show auth prompt if not logged in
  useEffect(() => {
    if (isAuthenticated || showAuthPrompt || isStreaming) return
    const userMsgs = messages.filter((m) => m.role === 'user')
    const assistantResponses = messages.filter((m) => m.role === 'assistant' && m.content.length > 50)
    if (userMsgs.length >= 1 && assistantResponses.length >= 2) {
      setShowAuthPrompt(true)
    }
  }, [messages, isStreaming, isAuthenticated, showAuthPrompt])

  // Clear auth prompt when user signs in
  useEffect(() => {
    if (isAuthenticated) setShowAuthPrompt(false)
  }, [isAuthenticated])

  // Auto-save session when streaming finishes
  useEffect(() => {
    if (isStreaming || !isAuthenticated) return
    const sessionId = currentSessionIdRef.current
    if (!sessionId) return
    const hasContent = messages.some((m) => m.role === 'user')
    if (!hasContent) return

    const title = generateTitle(messages.find((m) => m.role === 'user')?.content || 'New Session')
    fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, title }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((updated) => {
        if (updated) {
          setSessionList((prev) => {
            const filtered = prev.filter((s) => s.id !== sessionId)
            return [{ id: updated.id, title: updated.title, updatedAt: updated.updatedAt }, ...filtered]
          })
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  // Save current anonymous conversation when user signs in
  useEffect(() => {
    if (!isAuthenticated) return
    const hasContent = messages.some((m) => m.role === 'user')
    if (!hasContent || currentSessionIdRef.current) return

    const title = generateTitle(messages.find((m) => m.role === 'user')?.content || 'New Session')
    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, messages }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((created) => {
        if (created) {
          setCurrentSessionId(created.id)
          setSessionList((prev) => [{ id: created.id, title: created.title, updatedAt: created.updatedAt }, ...prev])
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    if (showAuthPrompt && !isAuthenticated) {
      setAuthModalTab('signin')
      setShowAuthModal(true)
      return
    }

    const userMsg: Message = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsStreaming(true)

    // Create a session if authenticated and no current session
    let sessionId = currentSessionIdRef.current
    if (isAuthenticated && !sessionId) {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: generateTitle(text), messages: [...messages, userMsg] }),
        })
        if (res.ok) {
          const created = await res.json()
          sessionId = created.id
          setCurrentSessionId(created.id)
          setSessionList((prev) => [{ id: created.id, title: created.title, updatedAt: created.updatedAt }, ...prev])
        }
      } catch {
        // continue without saving
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Something went wrong. Please try again.')
      }
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let sources: Source[] = []
      let sourcesParsed = false

      setMessages((m) => [...m, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullContent += decoder.decode(value, { stream: true })

        if (!sourcesParsed && fullContent.includes('-->')) {
          const match = fullContent.match(/<!--SOURCES:(.*?)-->/)
          if (match) {
            try { sources = JSON.parse(match[1]) } catch { /* ignore */ }
            fullContent = fullContent.replace(/<!--SOURCES:.*?-->/, '')
            sourcesParsed = true
          }
        }

        const displayContent = sourcesParsed ? fullContent : fullContent.replace(/<!--SOURCES:.*/, '')

        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: displayContent, sources: sources.length > 0 ? sources : undefined }
          return copy
        })
      }

      if (sources.length > 0) {
        setMessages((m) => {
          const copy = [...m]
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { ...last, sources }
          return copy
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sorry, something went wrong. Please try again.'
      setMessages((m) => [...m, { role: 'assistant', content: msg }])
    } finally {
      setIsStreaming(false)
    }
  }, [messages, isStreaming, isAuthenticated, showAuthPrompt])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !initialQuerySent.current) {
      initialQuerySent.current = true
      router.replace('/study', { scroll: false })
      setCurrentSessionId(null)
      setMessages([GREETING])
      sendMessage(q)
    }
  }, [searchParams, router, sendMessage])

  const handleNewSession = useCallback(() => {
    if (isStreaming) return
    setCurrentSessionId(null)
    setMessages([GREETING])
    setInput('')
    setOpenSources([])
    setShowAuthPrompt(false)
    setMobileDrawerOpen(false)
  }, [isStreaming])

  const loadSession = useCallback(async (id: string) => {
    if (isStreaming) return
    try {
      const res = await fetch(`/api/sessions/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setCurrentSessionId(id)
      setMessages(data.messages)
      setOpenSources([])
      setShowAuthPrompt(false)
      setMobileDrawerOpen(false)
    } catch {
      // ignore
    }
  }, [isStreaming])

  const deleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      setSessionList((prev) => prev.filter((s) => s.id !== id))
      if (currentSessionIdRef.current === id) {
        setCurrentSessionId(null)
        setMessages([GREETING])
        setOpenSources([])
      }
    } catch {
      // ignore
    }
  }, [])

  const openAuth = useCallback((tab: 'signin' | 'signup') => {
    setAuthModalTab(tab)
    setShowAuthModal(true)
  }, [])

  const hasUserMessages = messages.some((m) => m.role === 'user')

  // Session sidebar content (reused for desktop and mobile drawer)
  const sessionSidebarContent = (
    <>
      <div className="p-3">
        <h3 className="text-xs font-semibold text-[var(--text-sec)] uppercase tracking-wider mb-3">Sessions</h3>
        <button
          onClick={handleNewSession}
          disabled={isStreaming}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[var(--primary)] hover:text-white disabled:opacity-50 transition-all mb-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {sessionList.map((s) => (
          <div
            key={s.id}
            className={`group flex items-start gap-1 px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-all ${
              currentSessionId === s.id
                ? 'bg-[#eef2ff] text-[var(--primary)]'
                : 'text-[var(--text-sec)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]'
            }`}
            onClick={() => loadSession(s.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.title || 'Untitled'}</div>
              <div className="text-xs text-[var(--text-sec)] mt-0.5">{formatRelativeTime(s.updatedAt)}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-[var(--text-sec)] hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        ))}
        {sessionList.length === 0 && (
          <p className="text-xs text-[var(--text-sec)] text-center py-4 px-2">No saved sessions yet. Start a conversation to create one.</p>
        )}
      </div>

      {/* Bottom: sign in or user info */}
      <div className="p-3 border-t border-[var(--border)]">
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {authSession?.user?.name?.[0]?.toUpperCase() || authSession?.user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{authSession?.user?.name || authSession?.user?.email}</div>
            </div>
            <button
              onClick={() => signOut()}
              className="text-xs text-[var(--text-sec)] hover:text-[var(--text)] transition-colors"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => openAuth('signin')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-sec)] hover:text-[var(--primary)] hover:bg-[var(--surface-alt)] rounded-lg transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Sign in to save sessions
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      <div className="flex gap-0 h-full">
        {/* Desktop session sidebar */}
        <div className="w-60 flex-shrink-0 hidden md:flex flex-col border-r border-[var(--border)]">
          {sessionSidebarContent}
        </div>

        {/* Mobile combined drawer: sessions + nav */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileDrawerOpen(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <Link href="/" onClick={() => setMobileDrawerOpen(false)} className="flex items-center gap-2 font-serif text-lg font-bold text-[var(--primary)]">
                  <LogoMark size={24} />
                  Torah
                </Link>
                <button onClick={() => setMobileDrawerOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-sec)] hover:bg-[var(--surface-alt)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Sessions section */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {sessionSidebarContent}
              </div>

              {/* Divider + Nav links */}
              <div className="border-t border-[var(--border)] px-3 py-3">
                {[
                  { label: 'Study Partner', href: '/study' },
                  { label: 'Torah Search', href: '/search' },
                  { label: 'Community', href: '/community' },
                  { label: 'Contact', href: '/contact' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-[var(--text-sec)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)] transition-all"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <div className="flex items-center gap-1.5 px-2 py-2 md:hidden border-b border-[var(--border)]">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-sec)] hover:bg-[var(--surface-alt)] transition-all"
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <span className="text-sm font-semibold text-[var(--primary)] flex-1 text-center font-serif">Study Partner</span>
            <div className="w-9" />
          </div>

          {/* Welcome landing or chat */}
          {!hasUserMessages && !isStreaming ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-[640px] text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] text-[var(--accent-text)] flex items-center justify-center font-serif text-lg font-semibold mx-auto mb-4">א</div>
                <h2 className="text-2xl font-serif font-bold text-[var(--primary)] mb-2">AI Torah Study Partner</h2>
                <p className="text-sm text-[var(--text-sec)] mb-8">Ask me anything about Torah, Talmud, Halacha, or Jewish philosophy — I&apos;ll find relevant sources and walk through them with you.</p>

                <div className="flex items-end gap-2.5 bg-white border border-[var(--border)] rounded-xl px-3 py-2.5 focus-within:border-[var(--primary-light)] transition-colors">
                  <textarea
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                    placeholder="Ask about any Torah text or topic..."
                    className="flex-1 border-none outline-none resize-none font-sans text-sm leading-snug max-h-[120px] bg-transparent"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={isStreaming}
                    className="w-9 h-9 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0 hover:bg-[var(--primary-light)] disabled:opacity-50 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap justify-center">
                  {HINTS.map((hint) => (
                    <button key={hint} onClick={() => sendMessage(hint)} className="bg-white border border-[var(--border)] rounded-full px-3 py-1 text-xs text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-5 p-6 pb-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'self-end flex-row-reverse max-w-[80%]' : 'max-w-[85%]'}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${msg.role === 'user' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--accent-light)] text-[var(--accent-text)] font-serif'}`}>
                      {msg.role === 'user' ? 'U' : 'א'}
                    </div>
                    <div>
                      <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[var(--primary)] text-white rounded-tr-sm' : 'bg-white border border-[var(--border)] rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && msg.content && !isStreaming && (
                        <div className="mt-1.5">
                          <CopyButton text={msg.content} />
                        </div>
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => setOpenSources((prev) => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                            className="flex items-center gap-1.5 text-xs text-[var(--text-sec)] hover:text-[var(--text)] transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            {msg.sources.length} sources retrieved
                          </button>
                          {openSources.includes(i) && (
                            <div className="mt-2 flex flex-col gap-2">
                              {msg.sources.map((src) => (
                                <div key={src.ref} className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-md p-3">
                                  <div className="text-xs font-semibold text-[var(--accent-text)] mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                      {src.ref} · {src.type}
                                    </span>
                                    <a
                                      href={`https://www.sefaria.org/${src.ref.replace(/ /g, '_')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[var(--primary)] hover:underline"
                                    >
                                      View on Sefaria
                                    </a>
                                  </div>
                                  {src.hebrew && <div className="hebrew text-sm mb-1.5 leading-loose">{src.hebrew}</div>}
                                  {src.english && <div className="text-xs text-[var(--text-sec)]">{src.english}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isStreaming && messages[messages.length - 1]?.content === '' && (
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent-text)] flex items-center justify-center font-serif text-sm font-semibold flex-shrink-0">א</div>
                    <div className="bg-white border border-[var(--border)] rounded-xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-sec)]">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((j) => (
                            <span key={j} className="w-1.5 h-1.5 rounded-full bg-[var(--primary-light)] animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                          ))}
                        </div>
                        Searching sources & generating response...
                      </div>
                    </div>
                  </div>
                )}

                {/* Auth prompt */}
                {showAuthPrompt && !isAuthenticated && !isStreaming && (
                  <div className="mx-auto max-w-md bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl p-5 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <p className="text-sm font-medium mb-1">Sign in to keep studying</p>
                    <p className="text-xs text-[var(--text-sec)] mb-4">Create a free account to save this conversation and continue asking questions.</p>
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => openAuth('signup')} className="px-5 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-light)] transition-all">
                        Create Account
                      </button>
                      <button onClick={() => openAuth('signin')} className="px-5 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-sec)] hover:bg-[var(--surface-alt)] transition-all">
                        Sign In
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="px-6 pb-4 pt-2 flex-shrink-0">
                {showAuthPrompt && !isAuthenticated ? (
                  <div className="flex items-center justify-center gap-2 bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-sec)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Sign in to continue the conversation</span>
                    <button onClick={() => openAuth('signin')} className="text-[var(--primary)] font-medium hover:underline ml-1">Sign in</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end gap-2.5 bg-white border border-[var(--border)] rounded-xl px-3 py-2.5 focus-within:border-[var(--primary-light)] transition-colors">
                      <textarea
                        rows={1}
                        value={input}
                        onChange={(e) => {
                          setInput(e.target.value)
                          e.target.style.height = 'auto'
                          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                        placeholder="Ask about any Torah text or topic..."
                        className="flex-1 border-none outline-none resize-none font-sans text-sm leading-snug max-h-[120px] bg-transparent"
                      />
                      <button
                        onClick={() => sendMessage(input)}
                        disabled={isStreaming}
                        className="w-9 h-9 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0 hover:bg-[var(--primary-light)] disabled:opacity-50 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                    </div>
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      {HINTS.map((hint) => (
                        <button key={hint} onClick={() => sendMessage(hint)} className="bg-white border border-[var(--border)] rounded-full px-3 py-1 text-xs text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
                          {hint}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} defaultTab={authModalTab} />
    </>
  )
}
