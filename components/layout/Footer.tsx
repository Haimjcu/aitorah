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
            { title: 'Product', links: [{ label: 'Study Partner', href: '/study' }, { label: 'Torah Search', href: '/search' }, { label: 'App Directory', href: '/apps' }, { label: 'Marketplace', href: '/contact' }, { label: 'Pricing', href: '/contact' }] },
            { title: 'Community', links: [{ label: 'Forum', href: '/community' }, { label: 'Discord', href: 'https://discord.gg/7aXpVR6AK' }, { label: 'Events', href: '/events' }, { label: 'Blog', href: '/blog' }, { label: 'Resources', href: '/contact' }] },
            { title: 'Company', links: [{ label: 'About', href: '/contact' }, { label: 'Contact', href: '/contact' }, { label: 'Privacy', href: '/contact' }, { label: 'Terms', href: '/contact' }] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">{col.title}</h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('http') ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-white/55 hover:text-white transition-colors">{link.label}</a>
                    ) : (
                      <Link href={link.href} className="text-sm text-white/55 hover:text-white transition-colors">{link.label}</Link>
                    )}
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
              { title: 'Discord', href: 'https://discord.gg/7aXpVR6AK', path: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z' },
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
