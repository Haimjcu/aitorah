import Link from 'next/link'
import { LogoMark } from '@/components/ui/LogoMark'

export function Footer() {
  return (
    <footer className="bg-[#0f1e30] text-white/70 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3 text-white">
              <LogoMark size={28} variant="light" />
              <span className="font-serif text-lg">AI Torah</span>
            </div>
            <p className="text-sm text-white/50 max-w-[260px] leading-relaxed">
              A hub for scholars and developers at the intersection of Jewish wisdom and artificial intelligence.
            </p>
          </div>
          {[
            { title: 'Product', links: ['Study Partner', 'Torah Search', 'App Directory', 'Marketplace', 'Pricing'] },
            { title: 'Community', links: ['Forum', 'Discord', 'Events', 'Blog', 'Resources'] },
            { title: 'Company', links: ['About', 'Contact', 'Privacy', 'Terms'] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">{col.title}</h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link href="/contact" className="text-sm text-white/55 hover:text-white transition-colors">{link}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-6 flex justify-between items-center text-xs text-white/40">
          <span>&copy; 2026 AI Torah. All rights reserved.</span>
          <div className="flex gap-3">
            {[
              { title: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61576985863931', path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
              { title: 'LinkedIn', href: 'https://www.linkedin.com/company/ai-torah/', path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
            ].map((s) => (
              <a key={s.title} href={s.href} target="_blank" rel="noopener noreferrer" title={s.title} className="w-8 h-8 rounded-md bg-white/7 flex items-center justify-center text-white/50 hover:bg-white/15 hover:text-white transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={s.path}/></svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
