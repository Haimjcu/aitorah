'use client'

import { useState } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: { ref: string; type: string; similarity: number; hebrew: string; english: string }[]
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'assistant',
    content: 'Shalom! I\'m your AI Torah study partner. Ask me anything about Torah, Talmud, Halacha, or Jewish philosophy — I\'ll find relevant sources and walk through them with you.',
  },
  {
    role: 'user',
    content: 'What does the Talmud say about honesty in business dealings?',
  },
  {
    role: 'assistant',
    content: 'The Talmud addresses business honesty extensively, with the foundational principle being emet (truth) as a core value in all commercial dealings.\n\nIn Bava Metzia 49a, the Talmud establishes that verbal commitments in commerce carry moral weight — "one who goes back on his word, even if not legally binding, is considered morally deficient." This creates a standard higher than what secular contract law requires.\n\nThe Chafetz Chaim in his commentary extends this to prohibit any misleading impression, even through technically true statements — what we today call "half-truths." The concept of geneivat da\'at (literally "stealing the mind") covers deception that doesn\'t involve lying outright.',
    sources: [
      { ref: 'Bava Metzia 49a', type: 'Gemara · Talmud Bavli', similarity: 96, hebrew: 'אָמַר רַבִּי יוֹחָנָן: לֹא הֶחֱזִיר דָּבָר שֶׁבְּדִבּוּר', english: '"Rabbi Yochanan said: One who reneges on a verbal commitment has not fulfilled his obligation."' },
      { ref: 'Shabbat 55a', type: 'Gemara · Talmud Bavli', similarity: 91, hebrew: 'חוֹתָמוֹ שֶׁל הַקָּדוֹשׁ בָּרוּךְ הוּא אֱמֶת', english: '"The seal of the Holy One, Blessed be He, is truth."' },
    ],
  },
]

const HINTS = ['What are the 613 commandments?', 'Explain Shabbat laws', 'Sources on prayer', 'Kashrut overview']

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [openSources, setOpenSources] = useState<number[]>([])

  const sendMessage = async (text: string) => {
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
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      setMessages((m) => [...m, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantContent += decoder.decode(value, { stream: true })
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: assistantContent }
          return copy
        })
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Session list */}
      <div className="w-60 flex-shrink-0">
        <h3 className="text-xs font-semibold text-[var(--text-sec)] uppercase tracking-wider mb-3">Sessions</h3>
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[var(--primary)] hover:text-white transition-all mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Session
        </button>
        {[
          { title: 'Honesty in business (Talmud)', date: 'Today', active: true },
          { title: 'Shabbat candle lighting times', date: 'Yesterday' },
          { title: 'Parasha Lech Lecha — key themes', date: '2 days ago' },
          { title: 'Tzedakah obligations — sources', date: 'Jun 1' },
        ].map((s) => (
          <div key={s.title} className={`flex items-start gap-2.5 p-3 rounded-lg cursor-pointer border mb-1 transition-all ${s.active ? 'bg-white border-[var(--primary-light)]' : 'border-transparent hover:bg-white hover:border-[var(--border)]'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" style={{ color: s.active ? 'var(--primary)' : 'var(--text-sec)' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <div>
              <div className="text-sm font-medium leading-snug">{s.title}</div>
              <div className="text-xs text-[var(--text-sec)] mt-0.5">{s.date}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 pb-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'self-end flex-row-reverse max-w-[80%]' : 'max-w-[85%]'}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${msg.role === 'user' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--accent-light)] text-[var(--accent-text)] font-serif'}`}>
                {msg.role === 'user' ? 'HL' : 'א'}
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
                      {msg.sources.length} sources used
                    </button>
                    {openSources.includes(i) && (
                      <div className="mt-2 flex flex-col gap-2">
                        {msg.sources.map((src) => (
                          <div key={src.ref} className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-md p-3">
                            <div className="text-xs font-semibold text-[var(--accent-text)] mb-1.5 flex items-center gap-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                              {src.ref} · {src.type} · Similarity {src.similarity}%
                            </div>
                            <div className="hebrew text-sm mb-1.5 leading-loose">{src.hebrew}</div>
                            <div className="text-xs text-[var(--text-sec)]">{src.english}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent-text)] flex items-center justify-center font-serif text-sm font-semibold flex-shrink-0">א</div>
              <div className="bg-white border border-[var(--border)] rounded-xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--primary-light)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
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
