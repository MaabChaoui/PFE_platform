'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Eraser, Info, Lock, Loader2, SlidersHorizontal } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ApiError, getPipelineConfig, resetPipeline } from '@/lib/api'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PipelineConfig, PipelineOption } from '@/lib/types'

/** Live mode does not ship this session (S10-BE wires it). When false, every
 *  `requires_live` control renders but is DISABLED with a hint — the catalog is
 *  a faithful preview of the locked Phase E config, not an interactive surface. */
const LIVE_ENABLED = false

const LIVE_HINT = 'Applies to live runs — arriving soon'

/** Two basic bool controls surfaced inline on the composer toolbar as a teaser. */
const INLINE_KEYS = ['enable_recursion', 'hyde'] as const

// ───────────────────────── value formatting ─────────────────────────

function displayValue(opt: PipelineOption): string {
  const v = opt.default
  if (opt.key === 'query_type') {
    return v == null ? 'Auto · classifier' : humanize(String(v))
  }
  if (v == null || v === '') return 'default'
  if (typeof v === 'boolean') return v ? 'On' : 'Off'
  return String(v)
}

// ───────────────────────── one control row ─────────────────────────

function OptionControl({ opt }: { opt: PipelineOption }) {
  const disabled = opt.requires_live && !LIVE_ENABLED
  const control = (() => {
    switch (opt.type) {
      case 'bool':
        return <Switch checked={Boolean(opt.default)} disabled={disabled} aria-readonly />
      case 'enum':
      case 'int':
        if (opt.allowed && opt.allowed.length > 0) {
          // Display-only faux-select (disabled): shows the locked default.
          return <FauxSelect value={displayValue(opt)} disabled={disabled} />
        }
        return (
          <Input
            value={displayValue(opt)}
            disabled={disabled}
            readOnly
            className="h-8 w-28 text-right font-mono text-xs"
          />
        )
      default:
        return (
          <Input
            value={opt.default == null ? '' : String(opt.default)}
            placeholder={opt.key === 'sub_model' ? 'SUB_LLM_MODEL (default)' : 'default'}
            disabled={disabled}
            readOnly
            className="h-8 w-40 text-right font-mono text-xs"
          />
        )
    }
  })()

  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-foreground/90">{opt.label}</span>
          {disabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              </TooltipTrigger>
              <TooltipContent>{LIVE_HINT}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{opt.help}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  )
}

function FauxSelect({ value, disabled }: { value: string; disabled?: boolean }) {
  return (
    <div
      aria-disabled={disabled}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-xs font-medium',
        disabled ? 'opacity-50' : 'cursor-default',
      )}
    >
      <span className="nums">{value}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
  )
}

// ───────────────────────── reset cache ─────────────────────────

function ResetCacheButton() {
  const [busy, setBusy] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => () => abortRef.current?.abort(), [])

  const onReset = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      const res = await resetPipeline(controller.signal)
      toast.success('Pipeline cache cleared', {
        description: `${res.cleared} cached ${res.cleared === 1 ? 'entry' : 'entries'} dropped.`,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error('Could not reset the cache', {
        description: err instanceof ApiError ? err.detail : 'Backend unreachable.',
      })
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onReset}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-xs font-medium text-foreground/80 transition-all duration-300 ease-spring hover:border-foreground/25 hover:text-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />}
      Reset cache
    </button>
  )
}

// ───────────────────────── inline composer toggles ─────────────────────────

/** A couple of basic bool controls previewed directly on the composer toolbar.
 *  A static on/off indicator (not an interactive switch) since these are
 *  live-only and disabled this session — honest about the locked default. */
function InlineToggle({ opt }: { opt: PipelineOption }) {
  const on = Boolean(opt.default)
  const label = opt.key === 'enable_recursion' ? 'Recursion' : opt.key === 'hyde' ? 'HyDE' : opt.label
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 py-1 opacity-80">
          <span
            className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-primary' : 'bg-foreground/25')}
          />
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{`${label} · ${on ? 'on' : 'off'} — ${LIVE_HINT}`}</TooltipContent>
    </Tooltip>
  )
}

// ───────────────────────── the control ─────────────────────────

/**
 * The run-configuration surface, merged into the composer. Renders a couple of
 * inline bool toggles (a teaser) plus a "Run config" button that opens a Sheet
 * with the full control catalog from GET /api/pipeline/config — basic controls
 * up top, advanced behind an accordion, and a Reset-cache action. Every control
 * is rendered from the API (nothing hardcoded); since live mode is not enabled
 * yet, `requires_live` controls render DISABLED with the live-only hint.
 */
export function RunConfig({ className }: { className?: string }) {
  const { data, isError } = useQuery<PipelineConfig>({
    queryKey: ['pipeline-config'],
    queryFn: ({ signal }) => getPipelineConfig(signal),
    staleTime: 5 * 60_000,
  })

  const options = data?.options ?? []
  const basic = options.filter((o) => !o.advanced)
  const advanced = options.filter((o) => o.advanced)
  const inline = INLINE_KEYS.map((k) => options.find((o) => o.key === k)).filter(
    (o): o is PipelineOption => Boolean(o),
  )

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {inline.map((opt) => (
        <span key={opt.key} className="hidden sm:inline-flex">
          <InlineToggle opt={opt} />
        </span>
      ))}

      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all duration-300 ease-spring hover:border-foreground/25 hover:text-foreground active:scale-[0.97]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Run config
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="space-y-1 border-b border-foreground/[0.07] p-5 text-left">
            <SheetTitle className="font-display text-xl tracking-tight">
              Run configuration
            </SheetTitle>
            <SheetDescription>
              The pipeline controls, read from{' '}
              <code className="font-mono text-[11px]">/api/pipeline/config</code>. Defaults
              are the locked Phase E configuration used for every replay.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* live-only banner — explains the disabled state up front */}
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-foreground/80">
                These controls apply to <span className="font-medium">live runs</span> —
                arriving soon. The offline replay path streams the precomputed locked run, so
                the catalog below is shown read-only.
              </p>
            </div>

            {isError ? (
              <p className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.02] px-3 py-6 text-center text-xs text-muted-foreground">
                The control catalog is unavailable while the backend is offline.
              </p>
            ) : (
              <>
                <SectionLabel>Basic</SectionLabel>
                <div className="divide-y divide-foreground/[0.06]">
                  {basic.map((opt) => (
                    <OptionControl key={opt.key} opt={opt} />
                  ))}
                </div>

                {advanced.length > 0 ? (
                  <Accordion type="single" collapsible className="mt-2">
                    <AccordionItem value="advanced" className="border-b-0">
                      <AccordionTrigger className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:no-underline">
                        Advanced · {advanced.length}
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <div className="divide-y divide-foreground/[0.06]">
                          {advanced.map((opt) => (
                            <OptionControl key={opt.key} opt={opt} />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-foreground/[0.07] p-4">
            <ResetCacheButton />
            <SheetClose asChild>
              <button
                type="button"
                className="rounded-lg bg-gradient-brand px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all duration-300 ease-spring hover:brightness-110 active:scale-[0.97]"
              >
                Done
              </button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  )
}
