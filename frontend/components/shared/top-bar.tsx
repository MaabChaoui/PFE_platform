'use client'

import { usePathname } from 'next/navigation'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/shared/theme-toggle'

const TITLES: Record<string, string> = {
  '/': 'Pipeline',
  '/architecture': 'Architecture',
  '/corpus': 'Corpus Explorer',
  '/kg': 'Knowledge Graph',
  '/benchmark': 'Benchmark',
  '/results': 'Results',
  '/about': 'About',
}

function titleFor(pathname: string): string {
  if (pathname === '/') return TITLES['/']
  const match = Object.keys(TITLES).find(
    (href) => href !== '/' && pathname.startsWith(href),
  )
  return match ? TITLES[match] : 'LexAlgeria'
}

/**
 * Sticky top bar inside the content column: sidebar trigger, a breadcrumb
 * (LexAlgeria / <page>), a model-version chip, and the theme toggle. Chrome
 * stays LTR; projector-legible.
 */
export function TopBar() {
  const pathname = usePathname()
  const title = titleFor(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <span className="hidden sm:inline">LexAlgeria</span>
        <span className="hidden text-muted-foreground/40 sm:inline">/</span>
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          AKN-RLM · v0.3
        </span>
        <ThemeToggle />
      </div>
    </header>
  )
}
