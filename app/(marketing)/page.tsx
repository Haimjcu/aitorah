import type { Metadata } from 'next'
import { HeroChat } from '@/components/home/HeroChat'

export const metadata: Metadata = {
  title: 'AI Torah — Explore Torah With The Help Of Artificial Intelligence',
  description: 'AI-powered Torah study partner and semantic search across Tanakh, Talmud, Mishnah, and more. Ask questions, get cited answers from authentic Jewish sources.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <div className="bg-[var(--bg)]">
      {/* Hero */}
      <section
        className="py-12 md:py-24 text-white relative overflow-hidden"
        style={{ background: 'var(--primary)' }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center md:bg-center bg-[center_top]"
          style={{
            backgroundImage: `url('/torah-scroll-bg.png')`,
            opacity: 0.12,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(ellipse at 70% 50%, rgba(181,145,74,.15) 0%, transparent 60%)`,
          }}
        />
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 bg-[rgba(181,145,74,.2)] border border-[rgba(181,145,74,.4)] text-[var(--accent-light)] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            We're building something new — get involved!
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold text-white mb-5 max-w-2xl leading-tight">
            Explore Torah<br />With The Help Of<br />Artificial Intelligence
          </h1>
          <p className="text-xl text-white/75 max-w-[560px] mb-9 leading-relaxed">
            A living community of scholars and developers building AI tools rooted in authentic tradition. Ask questions, study sources, and connect with others doing the same.
          </p>
          <HeroChat />
          <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t border-white/12 justify-center">
            {[['50,000+', 'Torah texts searchable'], ['Open', 'Free to use'], ['Sefaria-powered', 'Source library']].map(([num, label]) => (
              <div key={label}>
                <div className="font-serif text-3xl font-bold text-[var(--accent-light)]">{num}</div>
                <div className="text-sm text-white/60 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { bg: '#eef2ff', iconColor: 'var(--primary)', title: 'AI Study Partner', desc: 'Ask any question about Torah, Talmud, or Halacha. Get cited answers from authentic sources, streamed in real time.', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
              { bg: '#fef9ee', iconColor: 'var(--accent-dark)', title: 'Semantic Torah Search', desc: 'Search by meaning, not keywords. Find relevant passages across Tanakh, Mishnah, Gemara, Rishonim, and Acharonim.', icon: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></> },
              { bg: '#f0fdf4', iconColor: '#16a34a', title: 'Community & Forum', desc: 'Structured threads for halachic questions, a developer lab for AI builders, and Discord for real-time collaboration.', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
            ].map((f) => (
              <div key={f.title} className="text-center p-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: f.bg }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={f.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
                </div>
                <h3 className="font-serif text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-[var(--text-sec)] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Torah quote example */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-[640px] mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-sec)] font-medium uppercase tracking-widest whitespace-nowrap">Example</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <p className="text-sm text-[var(--text-sec)] mb-4 text-center">A response from the AI Study Partner includes cited sources like this:</p>
            <div className="border-l-4 border-[var(--accent)] bg-[#fffdf5] px-6 py-5 rounded-r-lg">
              <div className="hebrew text-xl mb-2 leading-loose">אֱמֶת קְנֵה וְאַל-תִּמְכֹּר</div>
              <div className="text-[var(--text-sec)] text-sm italic mb-1.5">"Buy truth and do not sell it — also wisdom, discipline, and understanding."</div>
              <div className="text-sm text-[var(--accent-text)] font-semibold">— Mishlei 23:23</div>
            </div>
            <div className="text-center mt-8">
              <a href="/study" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-lg bg-[var(--accent)] text-white font-medium text-lg hover:bg-[var(--accent-dark)] transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Ask AI Torah
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-[var(--surface-alt)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl font-bold mb-3">How It Works</h2>
            <p className="text-[var(--text-sec)]">From question to cited Torah answer in seconds</p>
          </div>
          <div className="flex gap-0 relative">
            <div className="absolute top-7 left-[calc(16.6%+12px)] right-[calc(16.6%+12px)] h-0.5 bg-[var(--border)]" />
            {[['1', 'Ask a Question', 'Type your question in plain English about any Torah topic, halachic issue, or text.'], ['2', 'AI Finds Sources', 'Semantic search retrieves relevant passages from our indexed Torah corpus.'], ['3', 'Study the Answer', 'Receive a structured response with sources cited, in Hebrew and English.']].map(([n, title, desc]) => (
              <div key={n} className="flex-1 text-center px-4">
                <div className="w-14 h-14 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-serif text-2xl font-bold mx-auto mb-4 relative z-10">{n}</div>
                <h3 className="font-bold mb-1.5 text-base">{title}</h3>
                <p className="text-sm text-[var(--text-sec)]">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <a href="/study" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-lg bg-[var(--accent)] text-white font-medium text-lg hover:bg-[var(--accent-dark)] transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Ask AI Torah
            </a>
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="py-20 text-center bg-[var(--primary)] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-serif text-4xl font-bold text-white mb-3">Join the community building AI for Torah</h2>
          <p className="text-white/75 max-w-lg mx-auto mb-4">Scholars, developers, and educators working together to honor tradition through technology.</p>
          <p className="text-white/60 text-sm max-w-lg mx-auto mb-8">Our Discord server is the main community space — join to discuss halachic questions, collaborate on Torah AI projects, participate in live events, and connect with others who share this vision.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://discord.gg/7aXpVR6AK" target="_blank" rel="noopener noreferrer" className="px-7 py-4 rounded-lg bg-[#5865F2] text-white font-medium text-lg hover:bg-[#4752C4] transition-all inline-flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
              Join Our Discord
            </a>
            <a href="https://www.facebook.com/profile.php?id=61576985863931" target="_blank" rel="noopener noreferrer" className="px-7 py-4 rounded-lg border border-white/50 text-white font-medium text-lg hover:bg-white/10 transition-all inline-flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </a>
            <a href="https://www.linkedin.com/company/ai-torah/" target="_blank" rel="noopener noreferrer" className="px-7 py-4 rounded-lg border border-white/50 text-white font-medium text-lg hover:bg-white/10 transition-all inline-flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              LinkedIn
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
