import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Employee Tracking — LD Silk Mills',
  description: 'Employee performance tracking for LD Silk Mills',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#F4F4F6',
  width: 'device-width',
  initialScale: 1,
}

/**
 * Applies the saved theme before first paint. Without this the dark shell
 * flashes light on every navigation, which reads as a bug on a dark-first
 * design. Kept inline and tiny for that reason.
 */
const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem('epi-theme') || 'light';
    document.documentElement.setAttribute('data-epi-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-epi-theme', 'light');
  }
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-epi-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  )
}
