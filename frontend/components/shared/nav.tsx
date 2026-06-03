'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Scale } from 'lucide-react'

import { cn } from '@/lib/utils'
import { HealthBadge } from '@/components/shared/health-badge'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { PresenterToggle } from '@/components/shared/presenter-toggle'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/corpus', label: 'Corpus' },
  { href: '/kg', label: 'Knowledge Graph' },
  { href: '/benchmark', label: 'Benchmark' },
  { href: '/results', label: 'Results' },
  { href: '/about', label: 'About' },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}

/**
 * Sticky, projector-legible top nav: brand, the 7 routes with active highlight,
 * a live backend health badge, and the theme + presenter toggles. Chrome stays
 * LTR. On narrow widths the links wrap to a scrollable second row.
 */
export function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Scale className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight text-foreground">
            LexAlgeria
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            AKN-RLM
          </span>
        </Link>

        <nav className="ml-3 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              {...link}
              active={isActive(pathname, link.href)}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <HealthBadge />
          <PresenterToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Compact link row on narrow screens. */}
      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 scrollbar-thin lg:hidden">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.href}
            {...link}
            active={isActive(pathname, link.href)}
          />
        ))}
      </nav>
    </header>
  )
}
