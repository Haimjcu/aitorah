import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'serif'],
        hebrew: ['var(--font-hebrew)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#1a3a5c',
          light: '#2563eb',
        },
        accent: {
          DEFAULT: '#b5914a',
          dark: '#8a6a2e',
          light: '#f0d080',
          text: '#7a5c1e',
        },
        bg: '#fafaf8',
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f4f3ef',
        },
        border: '#e5e3db',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)',
        md: '0 4px 12px rgba(0,0,0,.10)',
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
