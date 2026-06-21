import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get involved with AI Torah. We are looking for developers, Torah scholars, and educators to help build AI-powered tools for Jewish learning.',
  alternates: { canonical: '/contact' },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
