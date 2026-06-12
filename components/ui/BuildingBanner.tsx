import Link from 'next/link'

export function BuildingBanner() {
  return (
    <section className="py-10 text-center" style={{ background: 'var(--primary)' }}>
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-white mb-3">We're Building Something New</h2>
        <p className="text-sm md:text-base text-white/75 leading-relaxed max-w-xl mx-auto mb-5">
          AI Torah is in its earliest stage. Most of what you see on this site is aspirational — a vision we're sharing to find the right people to build it with.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-dark)] transition-all"
        >
          Get Involved
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </Link>
      </div>
    </section>
  )
}
