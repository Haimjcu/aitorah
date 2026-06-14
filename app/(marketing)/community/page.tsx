import type { Metadata } from 'next'
import Link from 'next/link'
import { BuildingBanner } from '@/components/ui/BuildingBanner'

export const metadata: Metadata = { title: 'Community — AI Torah' }

const channels = [
  { name: 'General', desc: 'Main discussion space for AI conversation and community-wide discussion.' },
  { name: 'Developer Lab', desc: 'Share projects, get code reviews, and collaborate on Torah AI tools.' },
  { name: 'Ask / Learn', desc: 'Ask for help, feedback, recommendations, intros, collaborators, or advice.' },
  { name: 'Town Hall', desc: 'Help shape the community. Suggest what is missing, propose channels or events, or tell us what would make this space more useful.' },
  { name: 'Introductions', desc: 'Introduce yourself — scholars, developers, educators, and curious learners welcome.' },
  { name: 'Events & Shiurim', desc: 'Live event chat, shiur recordings, and hackathon coordination.' },
]

export default function CommunityPage() {
  return (
    <div className="bg-[var(--bg)]">
      {/* Hero */}
      <section className="py-20 text-center" style={{ background: 'var(--primary)' }}>
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Join the Community</h1>
          <p className="text-lg text-white/75 leading-relaxed max-w-xl mx-auto">
            Our Discord server is where the AI Torah community comes together — scholars, developers, and educators collaborating in real time.
          </p>
        </div>
      </section>

      {/* Discord Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white border border-[var(--border)] rounded-xl p-8 md:p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#5865F2] flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">Discord is Our Home Base</h2>
            <p className="text-[var(--text-sec)] leading-relaxed max-w-xl mx-auto mb-6">
              Discord is the heart of the AI Torah community. It's where Torah scholars ask halachic questions alongside developers building the next Torah AI tool. Join to explore channels for daily learning, developer collaboration, live event chat, and real-time discussion.
            </p>
            <a
              href="https://discord.gg/7aXpVR6AK"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-lg bg-[#5865F2] text-white font-medium text-lg hover:bg-[#4752C4] transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
              Join Our Discord Server
            </a>
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="font-serif text-xl font-bold mb-6 text-center">What You'll Find Inside</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((ch) => (
              <div key={ch.name} className="bg-white border border-[var(--border)] rounded-lg p-5 flex gap-4 items-start">
                <div className="w-9 h-9 rounded-lg bg-[#5865F2]/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[#5865F2]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 3L8 21M16 3l-2 18M3.5 9h17M3.5 15h17"/></svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-0.5">{ch.name}</h4>
                  <p className="text-sm text-[var(--text-sec)] leading-snug">{ch.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 bg-[var(--surface-alt)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="font-serif text-xl font-bold mb-3">Who's in the Community?</h3>
          <p className="text-[var(--text-sec)] max-w-lg mx-auto mb-8">
            Anyone passionate about Torah and technology is welcome.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Torah Scholars', desc: 'Rabbis, talmidei chachamim, and learners exploring how AI can enhance traditional study.' },
              { title: 'Developers', desc: 'Engineers building Torah AI tools — from RAG pipelines to chatbots to semantic search.' },
              { title: 'Educators', desc: 'Teachers and content creators developing AI-powered learning experiences for Jewish education.' },
            ].map((role) => (
              <div key={role.title} className="bg-white border border-[var(--border)] rounded-lg p-6">
                <h4 className="font-semibold mb-2">{role.title}</h4>
                <p className="text-sm text-[var(--text-sec)] leading-relaxed">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Also follow */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="font-serif text-xl font-bold mb-6">Follow Us</h3>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="https://www.facebook.com/profile.php?id=61576985863931" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-alt)] transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </a>
            <a href="https://www.linkedin.com/company/ai-torah/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-alt)] transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              LinkedIn
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
