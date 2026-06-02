import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'LexAlgeria — AKN-RLM Viva Demo',
  description: 'Interactive demo of the AKN-RLM citation-faithful Algerian legal QA system (ENSIA thesis)',
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/corpus', label: 'Corpus' },
  { href: '/kg', label: 'Knowledge Graph' },
  { href: '/benchmark', label: 'Benchmark' },
  { href: '/results', label: 'Results' },
  { href: '/about', label: 'About' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-indigo-900 text-white px-6 py-3 flex gap-x-6 flex-wrap items-center shadow">
          <span className="font-bold text-base tracking-tight mr-2">LexAlgeria</span>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-indigo-200 hover:text-white transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="px-6 py-8 max-w-7xl mx-auto">{children}</main>
      </body>
    </html>
  )
}
