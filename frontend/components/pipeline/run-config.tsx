'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Cpu, Eraser, Info, Lock, Loader2, SlidersHorizontal } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type { PipelineConfig, PipelineModelOption, PipelineOption } from '@/lib/types'

/** Two basic bool controls surfaced inline on the composer toolbar as a teaser. */
const INLINE_KEYS = ['enable_recursion', 'hyde'] as const

/** Catalog model roles → AnswerOptions field. These three options are rendered as
 *  dropdowns from `config.models`, so they're excluded from the generic list. */
const MODEL_ROLES: { role: string; key: string; title: string; sub: string }[] = [
  { role: 'generator', key: 'sub_model', title: 'Generator', sub: 'sub-LM that drafts the answer' },
  { role: 'classifier', key: 'classifier_model', title: 'Classifier', sub: 'picks the query type' },
  { role: 'supervisor', key: 'supervisor_model', title: 'Supervisor', sub: 'verifies each citation' },
]
const MODEL_OPTION_KEYS = new Set(MODEL_ROLES.map((m) => m.key))

/** Radix Select forbids an empty/`null` item value — map null ↔ a sentinel. */
const NULL_SENTINEL = '__null__'
const toKey = (v: unknown): string =>
  v === null || v === undefined ? NULL_SENTINEL : String(v)

export interface RunConfigProps {
  /** mode === 'live' && llm reachable → controls become interactive. */
  liveActive: boolean
  /** Flat overrides keyed by `/pipeline/config` option key (incl. `enhancers.eN`). */
  overrides: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  className?: string
}

// ───────────────────────── value formatting ─────────────────────────

function enumLabel(opt: PipelineOption, v: unknown): string {
  if (v === null || v === undefined) {
    return opt.key === 'query_type' ? 'Auto · classifier' : 'Default'
  }
  if (opt.key === 'query_type') return humanize(String(v))
  return String(v)
}

// ───────────────────────── one generic control row ─────────────────────────

function OptionControl({
  opt,
  value,
  disabled,
  onChange,
}: {
  opt: PipelineOption
  value: unknown
  disabled: boolean
  onChange: (key: string, value: unknown) => void
}) {
  const control = (() => {
    switch (opt.type) {
      case 'bool':
        return (
          <Switch
            checked={Boolean(value)}
            disabled={disabled}
            onCheckedChange={(v) => onChange(opt.key, v)}
            aria-label={opt.label}
          />
        )
      case 'enum':
      case 'int':
        if (opt.allowed && opt.allowed.length > 0) {
          return (
            <Select
              value={toKey(value)}
              disabled={disabled}
              onValueChange={(s) =>
                onChange(opt.key, s === NULL_SENTINEL ? null : opt.type === 'int' ? Number(s) : s)
              }
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opt.allowed.map((a) => (
                  <SelectItem key={toKey(a)} value={toKey(a)} className="text-xs">
                    {enumLabel(opt, a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        return <NumberInput opt={opt} value={value} disabled={disabled} onChange={onChange} />
      case 'float':
        return <NumberInput opt={opt} value={value} disabled={disabled} onChange={onChange} />
      default:
        return (
          <Input
            value={value == null ? '' : String(value)}
            disabled={disabled}
            onChange={(e) => onChange(opt.key, e.target.value === '' ? null : e.target.value)}
            placeholder="default"
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
          {disabled ? <LockHint /> : null}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{opt.help}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  )
}

function NumberInput({
  opt,
  value,
  disabled,
  onChange,
}: {
  opt: PipelineOption
  value: unknown
  disabled: boolean
  onChange: (key: string, value: unknown) => void
}) {
  return (
    <Input
      type="number"
      value={value == null ? '' : String(value)}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') return onChange(opt.key, null)
        const n = opt.type === 'float' ? parseFloat(raw) : parseInt(raw, 10)
        if (!Number.isNaN(n)) onChange(opt.key, n)
      }}
      className="h-8 w-28 text-right font-mono text-xs"
    />
  )
}

function LockHint() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Lock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
      </TooltipTrigger>
      <TooltipContent>Switch to Live to edit — replay streams the locked run</TooltipContent>
    </Tooltip>
  )
}

// ───────────────────────── model dropdown ─────────────────────────

function ModelSelect({
  roleKey,
  options,
  value,
  disabled,
  onChange,
}: {
  roleKey: string
  options: PipelineModelOption[]
  value: string | null
  disabled: boolean
  onChange: (key: string, value: unknown) => void
}) {
  const def = options.find((o) => o.default) ?? options[0]
  const current = value ?? def?.id ?? ''
  return (
    <Select
      value={current}
      disabled={disabled || options.length === 0}
      onValueChange={(v) => onChange(roleKey, def && v === def.id ? null : v)}
    >
      <SelectTrigger className="h-9 w-full text-xs">
        <SelectValue placeholder="Locked default" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id} className="text-xs">
            <span className="flex items-center gap-2">
              <span className="truncate">{o.label}</span>
              {o.default ? (
                <Badge variant="muted" className="px-1.5 py-0 font-mono text-[9px]">
                  default
                </Badge>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

/** Basic bool controls previewed on the composer toolbar. Interactive in live
 *  mode; a locked static indicator in replay (replay ignores options). */
function InlineToggle({
  opt,
  value,
  liveActive,
  onChange,
}: {
  opt: PipelineOption
  value: boolean
  liveActive: boolean
  onChange: (key: string, value: unknown) => void
}) {
  const label =
    opt.key === 'enable_recursion' ? 'Recursion' : opt.key === 'hyde' ? 'HyDE' : opt.label

  if (liveActive) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange(opt.key, !value)}
            aria-pressed={value}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all duration-300 ease-spring active:scale-[0.97]',
              value
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/25',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', value ? 'bg-primary' : 'bg-foreground/25')} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{`${label} · ${value ? 'on' : 'off'} — applies to this live run`}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 py-1 opacity-80">
          <span className={cn('h-1.5 w-1.5 rounded-full', value ? 'bg-primary' : 'bg-foreground/25')} />
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{`${label} · ${value ? 'on' : 'off'} — switch to Live to edit`}</TooltipContent>
    </Tooltip>
  )
}

// ───────────────────────── the control ─────────────────────────

/**
 * The run-configuration surface, merged into the composer. Inline bool toggles
 * (a teaser) + a "Run config" Sheet rendered entirely from GET /api/pipeline/config
 * (nothing hardcoded): basic controls, the generator/classifier/supervisor model
 * dropdowns from `config.models`, the read-only `fixed` stack, and the advanced
 * enhancers. In LIVE mode the controls are interactive and feed the live run's
 * options; in REPLAY they show the locked Phase E defaults, disabled.
 */
export function RunConfig({ liveActive, overrides, onChange, className }: RunConfigProps) {
  const { data, isError } = useQuery<PipelineConfig>({
    queryKey: ['pipeline-config'],
    queryFn: ({ signal }) => getPipelineConfig(signal),
    staleTime: 5 * 60_000,
  })

  const options = data?.options ?? []
  const models = data?.models ?? {}
  const modelOverridesEnabled = data?.model_overrides_enabled ?? false

  const generic = options.filter((o) => !MODEL_OPTION_KEYS.has(o.key))
  const basic = generic.filter((o) => !o.advanced)
  const advanced = generic.filter((o) => o.advanced)
  const inline = INLINE_KEYS.map((k) => options.find((o) => o.key === k)).filter(
    (o): o is PipelineOption => Boolean(o),
  )

  // What a control should DISPLAY: in live, the effective value (override else
  // default); in replay, always the locked default (replay ignores options).
  const shown = (opt: PipelineOption): unknown =>
    liveActive && opt.key in overrides ? overrides[opt.key] : opt.default

  const modelValue = (key: string): string | null =>
    liveActive ? ((overrides[key] as string | null | undefined) ?? null) : null

  const modelsDisabled = !liveActive || !modelOverridesEnabled

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {inline.map((opt) => (
        <span key={opt.key} className="hidden sm:inline-flex">
          <InlineToggle
            opt={opt}
            value={Boolean(shown(opt))}
            liveActive={liveActive}
            onChange={onChange}
          />
        </span>
      ))}

      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-300 ease-spring active:scale-[0.97]',
              liveActive
                ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/25 hover:text-foreground',
            )}
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
              Read from <code className="font-mono text-[11px]">/api/pipeline/config</code>.
              Defaults are the locked Phase E configuration.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* mode banner */}
            <div
              className={cn(
                'mb-4 flex items-start gap-2.5 rounded-xl border p-3',
                liveActive
                  ? 'border-primary/30 bg-primary/[0.07]'
                  : 'border-foreground/[0.1] bg-foreground/[0.03]',
              )}
            >
              <Info className={cn('mt-0.5 h-4 w-4 shrink-0', liveActive ? 'text-primary' : 'text-muted-foreground')} />
              <p className="text-xs leading-relaxed text-foreground/80">
                {liveActive ? (
                  <>
                    These controls apply to <span className="font-medium">this live run</span>.
                    Adjust freely — submitting sends them to the pipeline.
                  </>
                ) : (
                  <>
                    Replay streams the precomputed locked run, so these are shown read-only.
                    Switch to <span className="font-medium">Live</span> to make them editable.
                  </>
                )}
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
                    <OptionControl
                      key={opt.key}
                      opt={opt}
                      value={shown(opt)}
                      disabled={!liveActive}
                      onChange={onChange}
                    />
                  ))}
                </div>

                {/* model dropdowns */}
                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                    <SectionLabel className="mb-0">Models</SectionLabel>
                    {!modelOverridesEnabled ? (
                      <Badge variant="muted" className="px-1.5 py-0 font-mono text-[9px]">
                        overrides off
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    {MODEL_ROLES.map(({ role, key, title, sub }) => (
                      <div key={role}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-foreground/90">{title}</span>
                          <span className="text-[10px] text-muted-foreground">{sub}</span>
                        </div>
                        <ModelSelect
                          roleKey={key}
                          options={models[role] ?? []}
                          value={modelValue(key)}
                          disabled={modelsDisabled}
                          onChange={onChange}
                        />
                      </div>
                    ))}

                    {/* fixed stack — honest Table 3.6 context, not live knobs */}
                    {(models.fixed ?? []).length > 0 ? (
                      <div className="rounded-lg border border-dashed border-foreground/12 bg-foreground/[0.02] p-2.5">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Fixed local stack
                        </div>
                        <ul className="space-y-1">
                          {(models.fixed ?? []).map((o) => (
                            <li key={o.id} className="text-[11px] leading-snug text-muted-foreground">
                              {o.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>

                {advanced.length > 0 ? (
                  <Accordion type="single" collapsible className="mt-3">
                    <AccordionItem value="advanced" className="border-b-0">
                      <AccordionTrigger className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:no-underline">
                        Advanced · {advanced.length}
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <div className="divide-y divide-foreground/[0.06]">
                          {advanced.map((opt) => (
                            <OptionControl
                              key={opt.key}
                              opt={opt}
                              value={shown(opt)}
                              disabled={!liveActive}
                              onChange={onChange}
                            />
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

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
