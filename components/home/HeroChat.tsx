'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HeroChat() {
  const [input, setInput] = useState('')
  const router = useRouter()

  const submit = () => {
    const text = input.trim()
    if (!text) return
    router.push(`/study?q=${encodeURIComponent(text)}`)
  }

  return (
    <div className="max-w-[560px]">
      <div className="flex items-end gap-2.5 bg-white/10 backdrop-blur-sm border border-white/25 rounded-xl px-3 py-2.5 focus-within:border-white/50 transition-colors">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder="Ask about any Torah text or topic..."
          className="flex-1 border-none outline-none resize-none font-sans text-sm leading-snug max-h-[120px] bg-transparent text-white placeholder:text-white/70"
        />
        <button
          onClick={submit}
          className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center flex-shrink-0 hover:bg-[var(--accent-dark)] transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )
}
