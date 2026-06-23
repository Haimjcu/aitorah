import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter, Playfair_Display, Noto_Sans_Hebrew, JetBrains_Mono } from 'next/font/google'
import { Footer } from '@/components/layout/Footer'
import { AuthProvider } from '@/components/providers/AuthProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })
const notoHebrew = Noto_Sans_Hebrew({ subsets: ['hebrew'], variable: '--font-hebrew' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://aitorah.ai'),
  title: {
    default: 'AI Torah — Explore Torah With The Help Of Artificial Intelligence',
    template: '%s — AI Torah',
  },
  description: 'AI-powered Torah study partner and semantic search across Tanakh, Talmud, Mishnah, and more. Ask questions, get cited answers from authentic Jewish sources.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'AI Torah',
    title: 'AI Torah — Explore Torah With The Help Of Artificial Intelligence',
    description: 'AI-powered Torah study partner and semantic search across Tanakh, Talmud, Mishnah, and more. Ask questions, get cited answers from authentic Jewish sources.',
    url: 'https://aitorah.ai',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Torah — Explore Torah With The Help Of Artificial Intelligence',
    description: 'AI-powered Torah study partner and semantic search across Tanakh, Talmud, Mishnah, and more.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://aitorah.ai/#organization',
      name: 'AI Torah',
      url: 'https://aitorah.ai',
      logo: 'https://aitorah.ai/logo-transparent.png',
      description: 'AI-powered Torah study partner and semantic search across authentic Jewish sources.',
      sameAs: [
        'https://discord.gg/7aXpVR6AK',
        'https://www.facebook.com/profile.php?id=61576985863931',
        'https://www.linkedin.com/company/ai-torah/',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://aitorah.ai/#website',
      url: 'https://aitorah.ai',
      name: 'AI Torah',
      publisher: { '@id': 'https://aitorah.ai/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://aitorah.ai/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-5H6V6B7Z');`}
        </Script>
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${notoHebrew.variable} ${jetbrains.variable} font-sans`}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5H6V6B7Z"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <AuthProvider>
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
