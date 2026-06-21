'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type Source = { ref: string; type: string; similarity: number; hebrew: string; english: string }

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

const HINTS = ['What are the 613 commandments?', 'Explain Shabbat laws', 'What does Genesis 1:1 mean?', 'What does the Talmud say about honesty?']

export function ChatInterface() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Shalom! I\'m your AI Torah study partner. Ask me anything about Torah, Talmud, Halacha, or Jewish philosophy — I\'ll find relevant sources and walk through them with you.',
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [openSources, setOpenSources] = useState<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialQuerySent = useRef(false)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsStreaming(true)

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
            try {
              sources = JSON.parse(match[1])
            } catch {
              // ignore parse error
            }
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
  }, [messages])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !initialQuerySent.current) {
      initialQuerySent.current = true
      router.replace('/study', { scroll: false })
      sendMessage(q)
    }
  }, [searchParams, router, sendMessage])

  const hasUserMessages = messages.some((m) => m.role === 'user')

  if (!hasUserMessages && !isStreaming) {
    return (
      <div className="flex items-center justify-center h-full">
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
    )
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Session list */}
      <div className="w-60 flex-shrink-0 hidden md:block">
        <h3 className="text-xs font-semibold text-[var(--text-sec)] uppercase tracking-wider mb-3">Sessions</h3>
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[var(--primary)] hover:text-white transition-all mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Session
        </button>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-5 pb-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'self-end flex-row-reverse max-w-[80%]' : 'max-w-[85%]'}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${msg.role === 'user' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--accent-light)] text-[var(--accent-text)] font-serif'}`}>
                {msg.role === 'user' ? 'U' : 'א'}
              </div>
              <div>
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[var(--primary)] text-white rounded-tr-sm' : 'bg-white border border-[var(--border)] rounded-tl-sm'}`}>
                  {msg.content}
                </div>
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
        </div>

        {/* Input */}
        <div className="mt-4 flex-shrink-0">
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
        </div>
      </div>
    </div>
  )
}
