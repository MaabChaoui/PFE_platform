import type { Metadata } from 'next'
import './globals.css'
import { fontSans, fontDisplay, fontArabic } from './fonts'
import { Providers } from '@/components/providers'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { TopBar } from '@/components/shared/top-bar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'LexAlgeria — AKN-RLM Viva Demo',
  description:
    'Interactive demo of the AKN-RLM citation-faithful Algerian legal QA system (ENSIA thesis)',
}

// Pre-paint: set data-presenter from localStorage before first paint so the
// projector scale never flashes in. Mirrors next-themes' own inline script.
const PRESENTER_SCRIPT = `(function(){try{if(localStorage.getItem('presenter-mode')==='true'){document.documentElement.dataset.presenter='true';}}catch(e){}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        fontSans.variable,
        fontDisplay.variable,
        fontArabic.variable,
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRESENTER_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <TopBar />
              <div className="flex-1">{children}</div>
              <footer className="border-t border-border px-6 py-6 text-xs text-muted-foreground">
                <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
                  <span>
                    AKN-RLM — citation-faithful Algerian legal QA · ENSIA thesis
                  </span>
                  <span>Attia &amp; Chaoui · viva 13/06/2026</span>
                </div>
              </footer>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  )
}
