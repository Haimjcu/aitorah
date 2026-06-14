'use client'

import { useState } from 'react'
import Link from 'next/link'

const INTERESTS = [
  'Get notified when we launch',
  'Help build the platform',
  'Torah scholarship',
  'AI development',
  'Education & content',
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', interests: [] as string[] })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const toggleInterest = (interest: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(interest) ? f.interests.filter((i) => i !== interest) : [...f.interests, interest],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setSubmitted(true)
    } catch {
      // fall through
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-[var(--bg)]">
      {/* Hero */}
      <section className="py-20 text-center" style={{ background: 'var(--primary)' }}>
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">We're Building Something New</h1>
          <p className="text-lg text-white/75 leading-relaxed max-w-xl mx-auto">
            AI Torah is in its earliest stage. Most of what you see on this site is aspirational — a vision we're sharing to find the right people to build it with.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Vision */}
        <div className="grid md:grid-cols-2 gap-10 mb-16">
          <div>
            <h2 className="font-serif text-2xl font-bold mb-3">What's Coming</h2>
            <p className="text-[var(--text-sec)] text-sm leading-relaxed mb-4">
              We're building an ecosystem where Torah scholarship meets artificial intelligence — a study partner powered by authentic sources, semantic search across thousands of texts, and a community where scholars and developers collaborate.
            </p>
            <ul className="space-y-2.5">
              {[
                ['AI Study Partner', 'Conversational Torah study with cited sources, streamed in real time'],
                ['Semantic Search', 'Search by meaning across Tanakh, Mishnah, Gemara, and more'],
                ['Community', 'Forums, Discord, and live events for builders and learners'],
                ['Marketplace', 'A place for the community to share and sell Torah AI tools'],
              ].map(([title, desc]) => (
                <li key={title} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-semibold">{title}</span>
                    <span className="text-sm text-[var(--text-sec)]"> — {desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold mb-3">Get Involved</h2>
            <p className="text-[var(--text-sec)] text-sm leading-relaxed mb-4">
              We're actively organizing people to build the study and search infrastructure — the core engine that makes everything else possible. If you're a developer, Torah scholar, educator, or just someone who shares this vision, we want to hear from you.
            </p>
            <p className="text-[var(--text-sec)] text-sm leading-relaxed">
              The community will open soon. If you're interested in any way — or just want to be notified when the study partner, search, or community goes live — fill out the form below.
            </p>
          </div>
        </div>

        {/* About */}
        <div className="bg-white border border-[var(--border)] rounded-lg p-6 mb-16 flex items-start gap-5">
          <img
            src="/haim.jpeg"
            alt="Haim Lubin"
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
          <div>
            <h3 className="font-semibold text-base mb-1">Rabbi Haim Lubin</h3>
            <p className="text-sm text-[var(--text-sec)] mb-2">Rabbi & Developer</p>
            <p className="text-sm text-[var(--text-sec)] leading-relaxed mb-3">
              I started AI Torah to explore what becomes possible when you bring modern AI capabilities to traditional Jewish texts and scholarship. This project is a labor of love, and I'm looking for others who share the vision.
            </p>
            <a
              href="https://www.linkedin.com/in/corylubin/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary-light)] hover:underline"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              Connect on LinkedIn
            </a>
          </div>
        </div>

        {/* Form */}
        {submitted ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="font-serif text-2xl font-bold mb-2">Thank you!</h2>
            <p className="text-[var(--text-sec)]">We'll be in touch as things come together.</p>
            <Link href="/" className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-light)] transition-all">
              Back to Home
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="font-serif text-2xl font-bold mb-2 text-center">Stay in the Loop</h2>
            <p className="text-[var(--text-sec)] text-center mb-8">Tell us a bit about yourself and what interests you.</p>
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">I'm interested in</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-3.5 py-1.5 rounded-full text-sm border transition-all ${
                        form.interests.includes(interest)
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-white border-[var(--border)] text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Message <span className="text-xs text-[var(--text-sec)] font-normal">(optional)</span></label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us about yourself, your background, or how you'd like to contribute..."
                  className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-all"
              >
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
