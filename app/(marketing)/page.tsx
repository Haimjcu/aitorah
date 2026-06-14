import Link from 'next/link'

const featuredApps = [
  { emoji: '📖', name: 'Sefaria GPT', creator: 'Yosef Klein', status: 'Live', statusColor: 'badge-green', desc: "Ask questions over Sefaria's full library using GPT-4 with citation-level accuracy and linked source references.", tags: ['Sefaria', 'GPT-4', 'Study'] },
  { emoji: '⚖️', name: 'HalachaBot', creator: 'Miriam Cohen', status: 'Beta', statusColor: 'badge-blue', desc: 'Get halachic guidance with sourced answers from Shulchan Aruch and contemporary poskim. Not a psak—educational only.', tags: ['Halacha', 'Claude', 'LangChain'] },
  { emoji: '🎓', name: 'Parasha Tutor', creator: 'Dev Team AI', status: 'OSS', statusColor: 'badge-gold', desc: 'Weekly parasha study guide generator with custom learning levels, from child-friendly to advanced beit midrash.', tags: ['Education', 'Open Source'] },
]

const events = [
  { gradient: 'from-[#1a3a5c] to-[#2563eb]', badge: 'Webinar', badgeColor: 'badge-blue', platform: 'Zoom', platformColor: 'badge-gray', date: 'Thu Jun 12 · 7:00 PM EST', title: 'Building a Kosher AI: Ethics in Jewish Technology', desc: 'A discussion on halachic considerations when developing AI systems for Jewish communities.', cta: 'Register Free →' },
  { gradient: 'from-[#166534] to-[#15803d]', badge: 'Workshop', badgeColor: 'badge-green', platform: 'Discord', platformColor: 'badge-gray', date: 'Sun Jun 22 · 2:00 PM EST', title: 'LangChain + Sefaria: Build Your Own Torah Chatbot', desc: 'Hands-on workshop: connect LangChain to the Sefaria API and build a basic study assistant.', cta: 'Register →' },
  { gradient: 'from-[#7c3aed] to-[#a855f7]', badge: 'Lecture', badgeColor: 'badge-gold', platform: 'YouTube Live', platformColor: 'badge-gray', date: 'Fri Jul 4 · 12:00 PM EST', title: 'Rambam in the Age of AI: Rationalism Meets Machine Learning', desc: 'Interactive lecture exploring how Maimonidean philosophy applies to modern AI systems.', cta: 'Remind Me →' },
]

const blogPosts = [
  { bg: 'from-[#eef2ff] to-[#dbeafe]', badgeClass: 'badge-blue', category: 'Technology', date: 'May 28, 2025', title: 'How We Built Semantic Search Over 50,000 Torah Passages', excerpt: 'A technical walkthrough of embedding generation, pgvector indexing, and the HNSW vs. IVFFlat tradeoff at scale.', author: 'Dev team', initials: 'DL', readTime: '8 min read' },
  { bg: 'from-[#fffdf5] to-[#fef9ee]', badgeClass: 'badge-gold', category: 'Halacha', date: 'May 15, 2025', title: 'Can an AI Answer a Halachic Question? A Posek\'s Perspective', excerpt: 'Rabbi Y. Feldman explores the limits and possibilities of AI-assisted halachic decisioning from a traditional framework.', author: 'Rabbi Y. Feldman', initials: 'YF', readTime: '12 min read' },
  { bg: 'from-[#f0fdf4] to-[#dcfce7]', badgeClass: 'badge-green', category: 'Community', date: 'May 3, 2025', title: 'RLHF for Torah: Teaching AI Models What "Authentic" Means', excerpt: 'How human feedback from scholars and learners is shaping the next generation of Torah-aligned language models.', author: 'Miriam Cohen', initials: 'MC', readTime: '6 min read' },
]

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>{children}</span>
}

export default function HomePage() {
  return (
    <div className="bg-[var(--bg)]">
      {/* Hero */}
      <section
        className="py-24 text-white relative overflow-hidden"
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
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 bg-[rgba(181,145,74,.2)] border border-[rgba(181,145,74,.4)] text-[var(--accent-light)] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            We're bulding something new — get involved!
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold text-white mb-5 max-w-2xl leading-tight">
            Explore Torah<br />With The Help Of<br />Artificial Intelligence
          </h1>
          <p className="text-xl text-white/75 max-w-[560px] mb-9 leading-relaxed">
            A living community of scholars and developers building AI tools rooted in authentic tradition. Ask questions, study sources, and connect with others doing the same.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/study" className="px-7 py-4 rounded-lg bg-[var(--accent)] text-white font-medium text-lg hover:bg-[var(--accent-dark)] transition-all">
              Start Studying Free
            </Link>
            <Link href="/apps" className="px-7 py-4 rounded-lg border border-white/50 text-white font-medium text-lg hover:bg-white/10 transition-all">
              Explore Apps →
            </Link>
          </div>
          <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t border-white/12">
            {[['12,000+', 'Torah texts indexed'], ['340+', 'Community members'], ['48', 'AI apps in directory'], ['24', 'Events hosted']].map(([num, label]) => (
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
        </div>
      </section>

      {/* Featured Apps */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl font-bold mb-3">Featured AI Apps</h2>
            <p className="text-[var(--text-sec)]">Tools built by the community for Torah study, Halacha, and Jewish education</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredApps.map((app) => (
              <div key={app.name} className="bg-white border border-[var(--border)] rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="flex items-center gap-3 p-5 pb-0">
                  <div className="w-12 h-12 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-center text-2xl flex-shrink-0">{app.emoji}</div>
                  <div>
                    <div className="text-sm font-semibold">{app.name}</div>
                    <div className="text-xs text-[var(--text-sec)]">By {app.creator}</div>
                  </div>
                  <Badge className={`ml-auto ${badgeClass(app.statusColor)}`}>{app.status}</Badge>
                </div>
                <div className="p-5 pt-3">
                  <p className="text-sm text-[var(--text-sec)] leading-snug mb-3">{app.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {app.tags.map((t) => <Badge key={t} className="bg-[var(--surface-alt)] text-[var(--text-sec)]">{t}</Badge>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/apps" className="inline-flex items-center px-5 py-2.5 border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[var(--primary)] hover:text-white transition-all">
              View All 48 Apps →
            </Link>
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="py-20 bg-[var(--surface-alt)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl font-bold mb-3">Upcoming Events</h2>
            <p className="text-[var(--text-sec)]">Live webinars, workshops, and interactive Torah+AI sessions</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.map((e) => (
              <div key={e.title} className="bg-white border border-[var(--border)] rounded-lg shadow-sm overflow-hidden">
                <div className={`h-40 bg-gradient-to-br ${e.gradient} flex items-end p-4`}>
                  <div className="flex items-center gap-1.5 text-sm text-white/80">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {e.date}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex gap-2 mb-2">
                    <Badge className={badgeClass(e.badgeColor)}>{e.badge}</Badge>
                    <Badge className={badgeClass(e.platformColor)}>{e.platform}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-2 leading-snug">{e.title}</h3>
                  <p className="text-xs text-[var(--text-sec)] mb-3">{e.desc}</p>
                  <button className="px-4 py-1.5 bg-[var(--primary)] text-white rounded-md text-sm font-medium hover:bg-[#243f6a] transition-all">{e.cta}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl font-bold mb-3">From the Blog</h2>
            <p className="text-[var(--text-sec)]">Perspectives on AI, Torah, and the people building at their intersection</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <div key={post.title} className="bg-white border border-[var(--border)] rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-44 bg-gradient-to-br ${post.bg} flex items-center justify-center`} />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={badgeClass(post.badgeClass)}>{post.category}</Badge>
                    <span className="text-xs text-[var(--text-sec)]">{post.date}</span>
                  </div>
                  <h3 className="font-serif text-base font-bold mb-2 leading-snug">{post.title}</h3>
                  <p className="text-sm text-[var(--text-sec)] leading-snug line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="w-7 h-7 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--text-sec)]">{post.initials}</div>
                    <span className="text-xs text-[var(--text-sec)]">{post.author} · {post.readTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/blog" className="inline-flex items-center px-5 py-2.5 border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[var(--primary)] hover:text-white transition-all">
              Read All Articles →
            </Link>
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="py-20 text-center bg-[var(--primary)] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-serif text-4xl font-bold text-white mb-3">Join the community building AI for Torah</h2>
          <p className="text-white/75 max-w-md mx-auto mb-8">Scholars, developers, and educators working together to honor tradition through technology.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-7 py-4 rounded-lg bg-[var(--accent)] text-white font-medium text-lg hover:bg-[var(--accent-dark)] transition-all">Create Free Account</Link>
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

function badgeClass(name: string): string {
  const map: Record<string, string> = {
    'badge-gold': 'bg-[var(--accent-light)] text-[var(--accent-text)]',
    'badge-blue': 'bg-blue-100 text-blue-700',
    'badge-green': 'bg-green-100 text-green-700',
    'badge-gray': 'bg-[var(--surface-alt)] text-[var(--text-sec)]',
    'badge-red': 'bg-red-100 text-red-700',
  }
  return map[name] ?? map['badge-gray']
}
