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
  try {
    // The sidebar width is read from this attribute by CSS, so setting it
    // here means the rail is already the right width on first paint. React
    // learns about it afterwards and only needs it for the toggle's icon.
    if (localStorage.getItem('epi-sidebar') === 'rail') {
      document.documentElement.setAttribute('data-epi-rail', '1');
    }
  } catch (e) {}
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
