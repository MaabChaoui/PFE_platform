'use client'

import { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { PresenterProvider } from '@/components/shared/presenter-provider'

/**
 * Client-side context shell wrapped once in app/layout.tsx. Order matters:
 * TanStack Query (data) → next-themes (light/dark) → presenter (projector
 * scaling) → Radix Tooltip → toasts. Pages opt into any of these via hooks.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <PresenterProvider>
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            {children}
            <Toaster position="bottom-right" closeButton richColors />
          </TooltipProvider>
        </PresenterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
