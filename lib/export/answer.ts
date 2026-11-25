// Client-side export of answers / whole chats: Markdown, Word (.docx), and PDF via the browser's print dialog.
// Word export loads the `docx` library only when used, so it does not slow the chat page.

export interface ExportSource { ref: string }
export interface ExportItem { question: string; answer: string; sources?: ExportSource[] }
export interface ExportDoc {
  /** Document title: the question for one answer, or a chat title. */
  title: string
  items: ExportItem[]
  /** One answer: the question is the title. A chat: each question is a section heading. */
  kind: 'answer' | 'chat'
  labels: { question: string; sources: string; footer: string }
}

export const sefariaUrl = (ref: string) => `https://www.sefaria.org/${encodeURIComponent(ref.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%3A/g, ':')}`

/** A file name from the title; keeps Hebrew and other letters. */
export function fileNameFor(title: string, ext: string) {
  const base = title.normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
  return `${base || 'aitorah'}.${ext}`
}

/** Shift markdown headings down by n levels (answers inside a chat export sit under a question heading). */
function demoteHeadings(md: string, n: number) {
  if (!n) return md
  return md.replace(/^(#{1,6})(\s)/gm, (_, h: string, sp: string) => '#'.repeat(Math.min(6, h.length + n)) + sp)
}

export function toMarkdown(doc: ExportDoc): string {
  const out: string[] = [`# ${doc.title}`, '']
  for (const item of doc.items) {
    if (doc.kind === 'chat') out.push(`## ${item.question}`, '')
    out.push(demoteHeadings(item.answer.trim(), doc.kind === 'chat' ? 2 : 0), '')
    if (item.sources?.length) {
      out.push(`${doc.kind === 'chat' ? '###' : '##'} ${doc.labels.sources}`, '')
      for (const s of item.sources) out.push(`- [${s.ref}](${sefariaUrl(s.ref)})`)
      out.push('')
    }
  }
  out.push('---', '', `*${doc.labels.footer}*`, '')
  return out.join('\n')
}

/** Plain text for the clipboard: the answer plus its sources. */
export function toClipboardText(item: ExportItem, sourcesLabel: string) {
  const parts = [item.answer.trim()]
  if (item.sources?.length) parts.push(`${sourcesLabel}:\n${item.sources.map((s) => `- ${s.ref}: ${sefariaUrl(s.ref)}`).join('\n')}`)
  return parts.join('\n\n')
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadMarkdown(doc: ExportDoc) {
  saveBlob(new Blob([toMarkdown(doc)], { type: 'text/markdown;charset=utf-8' }), fileNameFor(doc.title, 'md'))
}

// ---------- Word ----------

const isRtl = (s: string) => {
  const m = s.match(/[A-Za-zÀ-ɏЀ-ӿ֐-׿]/)
  return !!m && /[֐-׿]/.test(m[0])
}

export async function downloadDocx(doc: ExportDoc) {
  const d = await import('docx')
  const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = d
  const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]

  /** **bold**, *italic* / _italic_, `code`, [text](url) */
  function inline(text: string, rtl: boolean, base: { bold?: boolean; italics?: boolean } = {}) {
    const runs: (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] = []
    const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g
    let last = 0
    for (const m of text.matchAll(re)) {
      if (m.index! > last) runs.push(new TextRun({ text: text.slice(last, m.index), rightToLeft: rtl || undefined, ...base }))
      const tok = m[0]
      if (tok.startsWith('**') || tok.startsWith('__')) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, rightToLeft: rtl || undefined, italics: base.italics }))
      else if (tok.startsWith('`')) runs.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', rightToLeft: rtl || undefined, ...base }))
      else if (tok.startsWith('[')) {
        const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!
        runs.push(new ExternalHyperlink({ link: lm[2], children: [new TextRun({ text: lm[1], style: 'Hyperlink', rightToLeft: rtl || undefined, ...base })] }))
      } else runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, rightToLeft: rtl || undefined, bold: base.bold }))
      last = m.index! + tok.length
    }
    if (last < text.length) runs.push(new TextRun({ text: text.slice(last), rightToLeft: rtl || undefined, ...base }))
    return runs
  }

  const para = (text: string, opts: Record<string, unknown> = {}, base: { bold?: boolean; italics?: boolean } = {}) => {
    const rtl = isRtl(text)
    return new Paragraph({ children: inline(text, rtl, base), bidirectional: rtl || undefined, alignment: rtl ? AlignmentType.RIGHT : undefined, spacing: { after: 120 }, ...opts })
  }

  function markdownBlocks(md: string, headingShift: number) {
    const blocks: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = []
    const lines = md.replace(/\r/g, '').split('\n')
    let buf: string[] = []
    const flush = () => { if (buf.length) { blocks.push(para(buf.join(' '))); buf = [] } }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      let m: RegExpMatchArray | null
      if (!trimmed) { flush(); continue }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flush(); continue }
      if ((m = trimmed.match(/^(#{1,6})\s+(.*)$/))) {
        flush()
        const level = Math.min(5, m[1].length - 1 + headingShift)
        blocks.push(para(m[2].replace(/^\*\*(.*)\*\*$/, '$1'), { heading: HEADINGS[level], spacing: { before: 200, after: 100 } }))
        continue
      }
      if (trimmed.startsWith('|')) {
        flush()
        const rows: string[][] = []
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
          if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
          i++
        }
        i--
        const cols = Math.max(...rows.map((r) => r.length))
        blocks.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: rows.map((r, ri) => new TableRow({
            children: Array.from({ length: cols }, (_, ci) => new TableCell({ children: [para(r[ci] ?? '', {}, ri === 0 ? { bold: true } : {})] })),
          })),
        }))
        blocks.push(new Paragraph({ children: [] }))
        continue
      }
      if ((m = line.match(/^(\s*)[-*+]\s+(.*)$/))) {
        flush()
        blocks.push(para(m[2], { bullet: { level: Math.min(3, Math.floor(m[1].length / 2)) }, spacing: { after: 60 } }))
        continue
      }
      if ((m = line.match(/^(\s*)(\d+[.)])\s+(.*)$/))) {
        flush()
        const rtl = isRtl(m[3])
        blocks.push(new Paragraph({
          children: [new TextRun({ text: `${m[2]} `, rightToLeft: rtl || undefined }), ...inline(m[3], rtl)],
          bidirectional: rtl || undefined, alignment: rtl ? AlignmentType.RIGHT : undefined,
          indent: { start: 360 + Math.floor(m[1].length / 2) * 360 }, spacing: { after: 60 },
        }))
        continue
      }
      if ((m = trimmed.match(/^>\s?(.*)$/))) {
        flush()
        blocks.push(para(m[1], { indent: { start: 540 }, spacing: { after: 100 } }, { italics: true }))
        continue
      }
      buf.push(trimmed)
    }
    flush()
    return blocks
  }

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [para(doc.title, { heading: HeadingLevel.TITLE })]
  for (const item of doc.items) {
    if (doc.kind === 'chat') children.push(para(item.question, { heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } }))
    children.push(...markdownBlocks(item.answer.trim(), doc.kind === 'chat' ? 1 : 0))
    if (item.sources?.length) {
      children.push(para(doc.labels.sources, { heading: doc.kind === 'chat' ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2 }))
      for (const s of item.sources) {
        const rtl = isRtl(s.ref)
        children.push(new Paragraph({
          bullet: { level: 0 }, bidirectional: rtl || undefined, spacing: { after: 40 },
          children: [new ExternalHyperlink({ link: sefariaUrl(s.ref), children: [new TextRun({ text: s.ref, style: 'Hyperlink', rightToLeft: rtl || undefined })] })],
        }))
      }
    }
  }
  children.push(new Paragraph({ children: [new TextRun({ text: doc.labels.footer, italics: true, color: '666666', size: 18 })], spacing: { before: 400 } }))

  const file = new Document({
    creator: 'AI Torah',
    title: doc.title,
    styles: { default: { document: { run: { font: 'Arial', size: 22, sizeComplexScript: 24 } } } },
    sections: [{ children }],
  })
  saveBlob(await Packer.toBlob(file), fileNameFor(doc.title, 'docx'))
}

// ---------- PDF (print) ----------

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * Prints the document in a hidden frame; the user picks "Save as PDF". `answerHtml` is the already-rendered
 * HTML of each answer (same order as doc.items), so the printout matches what is on screen.
 */
export function printDoc(doc: ExportDoc, answerHtml: string[], pageDir: 'ltr' | 'rtl') {
  const body = doc.items.map((item, i) => {
    const q = doc.kind === 'chat' ? `<h2 class="q" dir="auto">${esc(item.question)}</h2>` : ''
    const src = item.sources?.length
      ? `<h3 dir="auto">${esc(doc.labels.sources)}</h3><ul class="src">${item.sources.map((s) => `<li dir="auto"><a href="${esc(sefariaUrl(s.ref))}">${esc(s.ref)}</a></li>`).join('')}</ul>`
      : ''
    return `<section>${q}<div class="answer" dir="auto">${answerHtml[i] ?? esc(item.answer)}</div>${src}</section>`
  }).join('')
  const html = `<!doctype html><html dir="${pageDir}"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>
    @page { margin: 18mm; }
    body { font-family: "Noto Sans Hebrew", Arial, sans-serif; color: #1a1a1a; font-size: 11.5pt; line-height: 1.55; }
    h1 { font-family: Georgia, serif; font-size: 20pt; color: #1e2a5a; margin: 0 0 12pt; }
    h2.q { font-family: Georgia, serif; font-size: 15pt; color: #1e2a5a; border-top: 1px solid #ddd; padding-top: 12pt; margin-top: 20pt; }
    h2, h3, h4 { color: #1e2a5a; break-after: avoid; }
    a { color: #1e2a5a; }
    blockquote { border-inline-start: 3px solid #c9a84c; margin: 8pt 0; padding: 2pt 10pt; color: #444; }
    table { border-collapse: collapse; width: 100%; margin: 8pt 0; } th, td { border: 1px solid #ccc; padding: 4pt 6pt; text-align: start; }
    ul.src { font-size: 10pt; } .foot { margin-top: 24pt; font-size: 9pt; color: #777; font-style: italic; }
    section { break-inside: auto; }
  </style></head><body><h1 dir="auto">${esc(doc.title)}</h1>${body}<p class="foot">${esc(doc.labels.footer)}</p></body></html>`

  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  document.body.appendChild(frame)
  const w = frame.contentWindow!
  w.document.open()
  w.document.write(html)
  w.document.close()
  const cleanup = () => setTimeout(() => frame.remove(), 500)
  w.addEventListener('afterprint', cleanup)
  setTimeout(() => { w.focus(); w.print(); setTimeout(cleanup, 60000) }, 250)
}
