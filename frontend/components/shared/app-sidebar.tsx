'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sparkles,
  Library,
  Network,
  FlaskConical,
  BarChart3,
  Boxes,
  Info,
  Search,
  type LucideIcon,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { HealthBadge } from '@/components/shared/health-badge'
import { PresenterToggle } from '@/components/shared/presenter-toggle'

type NavItem = { title: string; href: string; icon: LucideIcon }

/* The 7 routes, grouped. To add a route: drop a {title,href,icon} here — the
 * active highlight (usePathname) and collapsed-icon tooltip come for free. */
const WORKSPACE: NavItem[] = [
  { title: 'Pipeline', href: '/', icon: Sparkles },
  { title: 'Corpus', href: '/corpus', icon: Library },
  { title: 'Knowledge Graph', href: '/kg', icon: Network },
  { title: 'Benchmark', href: '/benchmark', icon: FlaskConical },
  { title: 'Results', href: '/results', icon: BarChart3 },
]
const SYSTEM: NavItem[] = [
  { title: 'Architecture', href: '/architecture', icon: Boxes },
  { title: 'About', href: '/about', icon: Info },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  className="data-[active=true]:bg-primary/15 data-[active=true]:text-foreground"
                >
                  <Link href={item.href} aria-current={active ? 'page' : undefined}>
                    <item.icon
                      className={active ? 'text-primary' : 'text-sidebar-foreground/70'}
                    />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * Left app shell: gradient wordmark, a ⌘K search placeholder, the 7 routes in
 * WORKSPACE / SYSTEM groups with active highlight + collapsed-icon tooltips, and
 * a footer carrying the live health badge + presenter toggle. Collapsible to
 * icons (⌘B / the trigger in the top bar).
 */
export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pb-3 pt-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-brand font-display text-[15px] leading-none text-primary-foreground shadow-sm">
            L
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[17px] tracking-tight">
                LexAlgeria
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/55">
                AKN-RLM
              </span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {!collapsed && (
          <div className="mx-1 mb-1 mt-1 flex items-center gap-2 rounded-lg border border-sidebar-border bg-background/40 px-2.5 py-1.5 text-xs text-sidebar-foreground/60">
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="ml-auto rounded border border-sidebar-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </div>
        )}

        <NavGroup label="Workspace" items={WORKSPACE} pathname={pathname} />
        <NavGroup label="System" items={SYSTEM} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="p-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <PresenterToggle />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-background/40 px-2.5 py-2">
            <HealthBadge />
            <div className="ml-auto">
              <PresenterToggle />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
