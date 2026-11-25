'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Renders an answer's markdown (headings, bold, lists, tables) instead of showing raw symbols. */
export const AnswerMarkdown = memo(function AnswerMarkdown({ content }: { content: string }) {
  return (
    <div dir="auto" className="prose prose-sm max-w-none text-[var(--text)]
      prose-headings:font-serif prose-headings:text-[var(--primary)] prose-headings:mt-4 prose-headings:mb-2
      prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
      prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2
      prose-strong:text-[var(--text)] prose-a:text-[var(--primary)]
      prose-blockquote:border-s-[var(--accent)] prose-blockquote:not-italic prose-blockquote:text-[var(--text-sec)]
      prose-table:text-xs prose-th:text-start prose-td:align-top
      first:prose-headings:mt-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          p: ({ children }) => <p dir="auto">{children}</p>,
          li: ({ children }) => <li dir="auto">{children}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
