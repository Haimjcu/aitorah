import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter, Playfair_Display, Noto_Sans_Hebrew, JetBrains_Mono } from 'next/font/google'
import { Footer } from '@/components/layout/Footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })
const notoHebrew = Noto_Sans_Hebrew({ subsets: ['hebrew'], variable: '--font-hebrew' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'AI Torah — Explore Torah Through Artificial Intelligence',
  description: 'A living community of scholars and developers building AI tools rooted in authentic tradition.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
        {children}
        <Footer />
      </body>
    </html>
  )
}
