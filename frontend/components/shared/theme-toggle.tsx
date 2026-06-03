'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Light/dark toggle (persisted by next-themes). Mount-guarded to avoid SSR mismatch. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle light/dark theme"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {/* Render a stable icon until mounted to keep SSR/CSR markup identical. */}
          {mounted && isDark ? (
            <Sun className="h-[1.1rem] w-[1.1rem]" />
          ) : (
            <Moon className="h-[1.1rem] w-[1.1rem]" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
    </Tooltip>
  )
}
