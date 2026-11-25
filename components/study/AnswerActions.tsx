'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/components/providers/I18nProvider'
import { downloadDocx, downloadMarkdown, printDoc, type ExportDoc } from '@/lib/export/answer'

/** Approximate height of the download menu (3 two-line items), used to decide whether it opens up or down. */
const MENU_HEIGHT = 200

const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors'
const neutral = `${btn} border-[var(--border)] bg-white text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)]`

const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

/** Copies plain text plus rich HTML when the browser allows it (pastes formatted into Word, Gmail, Docs). */
export function CopyAnswerButton({ text, getHtml }: { text: string; getHtml?: () => string | undefined }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  async function copy() {
    const html = getHtml?.()
    try {
      if (html && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        })])
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button type="button" onClick={copy} title={t('chat.copyTip')} className={neutral}>
      {copied
        ? <Icon d={<polyline points="20 6 9 17 4 12" />} />
        : <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} />}
      {copied ? t('chat.copied') : t('chat.copy')}
    </button>
  )
}

/** Download as Markdown, Word, or PDF (print). */
export function DownloadMenu({ label, getDoc, getHtml, className = '' }: {
  label: string
  getDoc: () => ExportDoc
  /** Rendered HTML of each answer, for the PDF printout. */
  getHtml: () => string[]
  className?: string
}) {
  const { t, dir } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [up, setUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  /** Open upward when the menu would be hidden below the visible part of the scrolling chat (e.g. behind the input). */
  function toggle() {
    if (!open && ref.current) {
      const btnRect = ref.current.getBoundingClientRect()
      let bottom = window.innerHeight, top = 0
      for (let el = ref.current.parentElement; el; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY
        if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') { const r = el.getBoundingClientRect(); bottom = r.bottom; top = r.top; break }
      }
      const below = bottom - btnRect.bottom, above = btnRect.top - top
      setUp(below < MENU_HEIGHT && above > below)
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  async function run(kind: 'md' | 'docx' | 'pdf') {
    setOpen(false)
    const doc = getDoc()
    if (kind === 'md') downloadMarkdown(doc)
    else if (kind === 'pdf') printDoc(doc, getHtml(), dir)
    else {
      setBusy(true)
      try { await downloadDocx(doc) } catch (e) { console.error('docx export failed', e) } finally { setBusy(false) }
    }
  }

  const options: [kind: 'md' | 'docx' | 'pdf', title: string, hint: string][] = [
    ['docx', t('chat.downloadDocx'), t('chat.downloadDocxHint')],
    ['pdf', t('chat.downloadPdf'), t('chat.downloadPdfHint')],
    ['md', t('chat.downloadMd'), t('chat.downloadMdHint')],
  ]

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} disabled={busy} className={`${neutral} disabled:opacity-60`}>
        <Icon d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>} />
        {busy ? '…' : label}
        <Icon d={<polyline points="6 9 12 15 18 9" />} />
      </button>
      {open && (
        <div role="menu" className={`absolute z-30 ${up ? 'bottom-full mb-1' : 'top-full mt-1'} start-0 w-64 bg-white border border-[var(--border)] rounded-lg shadow-lg py-1`}>
          {options.map(([kind, title, hint]) => (
            <button key={kind} role="menuitem" type="button" onClick={() => run(kind)}
              className="w-full text-start px-3 py-2 hover:bg-[var(--surface-alt)]">
              <div className="text-sm font-medium text-[var(--text)]">{title}</div>
              <div className="text-xs text-[var(--text-sec)]">{hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The clearly visible "Suggest a correction" button under each answer. */
export function CorrectionButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button type="button" onClick={onClick} title={t('chat.correctionTip')} aria-expanded={active}
      className={`${btn} ${active
        ? 'border-[var(--accent)] bg-[#fbf6e9] text-[var(--accent-text)]'
        : 'border-[var(--accent)] bg-white text-[var(--accent-text)] hover:bg-[#fbf6e9]'}`}>
      <Icon d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>} />
      {t('chat.suggestCorrection')}
    </button>
  )
}
