'use client'

/**
 * The Retrieval Lab control surface — a designed instrument, not a form. A
 * double-bezel panel (outer tray + inner core) holds five grouped sections:
 * input mode, retriever channels, RRF fusion weights, the re-ranking baseline,
 * and depth. Every control maps to a real `/api/retrieval/compare` field
 * (plan.md §5); nothing is hardcoded into the output.
 *
 * Honesty (viva-critical): the LIVE RLM retrieve path is Hybrid (RRF) of
 * BM25 + Dense with EQUAL weights (1.0 / 1.0). The fusion-weight sliders and the
 * re-ranker are a Lab-only exploration the live path does NOT perform — both are
 * labelled as such here.
 */
import * as React from 'react'
import {
  Blend,
  FlaskConical,
  Gauge,
  Layers,
  Loader2,
  Play,
  Radar,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { isArabic } from '@/components/pipeline/utils'
import { cn } from '@/lib/utils'
import {
  type InputMode,
  type LabControls,
  type LabStatus,
} from '@/lib/use-retrieval-lab'

import { SeedInput, type SeedSelection } from './seed-input'

/** Canonical channel order — keeps the request key stable across toggle paths. */
const CANON = ['bm25', 'dense', 'hybrid', 'hybrid_rerank'] as const

const RETRIEVER_META: Record<string, { label: string; sub: string; icon: LucideIcon }> = {
  bm25: { label: 'BM25', sub: 'sparse · lexical', icon: Radar },
  dense: { label: 'Dense', sub: 'semantic · e5', icon: Sparkles },
  hybrid: { label: 'Hybrid', sub: 'RRF fusion', icon: Blend },
}

export interface ControlsProps {
  controls: LabControls
  seed: SeedSelection | null
  onChange: (patch: Partial<LabControls>) => void
  onSeedSelect: (sel: SeedSelection) => void
  onSeedClear: () => void
  onReset: () => void
  onRun: () => void
  status: LabStatus
  isValid: boolean
  className?: string
}

export function LabControlsPanel({
  controls,
  seed,
  onChange,
  onSeedSelect,
  onSeedClear,
  onReset,
  onRun,
  status,
  isValid,
  className,
}: ControlsProps) {
  const setMode = (mode: InputMode) => {
    if (mode === controls.mode) return
    // Switching modes clears the other field (exactly-one-of query|question_id).
    if (mode === 'seed') onChange({ mode, query: '' })
    else {
      onChange({ mode, questionId: null })
      onSeedClear()
    }
  }

  const toggleRetriever = (name: string) => {
    const next = controls.retrievers.includes(name)
      ? controls.retrievers.filter((r) => r !== name)
      : CANON.filter((r) => controls.retrievers.includes(r) || r === name)
    onChange({ retrievers: next })
  }

  const hybridOn = controls.retrievers.includes('hybrid')
  const rerankOn = controls.retrievers.includes('hybrid_rerank')
  const weightsDeviate =
    controls.rrfWeights.bm25 !== 1 || controls.rrfWeights.dense !== 1

  return (
    <div
      className={cn(
        'rounded-[1.4rem] p-1.5 ring-1 ring-foreground/[0.08] bg-foreground/[0.02]',
        className,
      )}
    >
      <div className="space-y-5 rounded-[calc(1.4rem-0.375rem)] bg-card/70 p-4 shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]">
        {/* ── Input mode ── */}
        <Group label="Input" hint="exactly one">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-foreground/[0.04] p-1">
            <ModeButton active={controls.mode === 'query'} onClick={() => setMode('query')}>
              Free query
            </ModeButton>
            <ModeButton active={controls.mode === 'seed'} onClick={() => setMode('seed')}>
              Benchmark question
            </ModeButton>
          </div>

          {controls.mode === 'query' ? (
            <div className="mt-2.5">
              <textarea
                value={controls.query}
                onChange={(e) => onChange({ query: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    onRun()
                  }
                }}
                placeholder="Type a legal question (Arabic or French)…"
                dir={isArabic(controls.query) ? 'rtl' : undefined}
                rows={3}
                className={cn(
                  'w-full resize-none rounded-xl border border-foreground/12 bg-foreground/[0.02] px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/55 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15',
                  isArabic(controls.query) && 'text-right font-arabic',
                )}
              />
              <p className="mt-1 px-0.5 text-[10.5px] text-muted-foreground/70">
                ⌘/Ctrl + Enter to run · no gold highlighting for free queries
              </p>
            </div>
          ) : (
            <div className="mt-2.5">
              <SeedInput selected={seed} onSelect={onSeedSelect} onClear={onSeedClear} />
            </div>
          )}
        </Group>

        <Divider />

        {/* ── Retrievers ── */}
        <Group label="Retrievers" icon={Layers}>
          <div className="grid grid-cols-3 gap-1.5">
            {(['bm25', 'dense', 'hybrid'] as const).map((name) => (
              <RetrieverChip
                key={name}
                meta={RETRIEVER_META[name]}
                active={controls.retrievers.includes(name)}
                live={name === 'hybrid'}
                onClick={() => toggleRetriever(name)}
              />
            ))}
          </div>
          <p className="mt-2 px-0.5 text-[10.5px] leading-relaxed text-muted-foreground/75">
            <span className="font-medium text-primary">Hybrid</span> is what the live
            RLM retrieves with — BM25 + Dense fused by RRF.
          </p>
        </Group>

        <Divider />

        {/* ── RRF fusion weights ── */}
        <Group
          label="Fusion weights"
          icon={Blend}
          hint={weightsDeviate ? 'exploring' : 'live = 1.0 / 1.0'}
          hintTone={weightsDeviate ? 'warn' : 'muted'}
        >
          <div className={cn('space-y-3', !hybridOn && 'pointer-events-none opacity-40')}>
            <WeightSlider
              label="BM25 weight"
              value={controls.rrfWeights.bm25}
              onChange={(v) => onChange({ rrfWeights: { ...controls.rrfWeights, bm25: v } })}
            />
            <WeightSlider
              label="Dense weight"
              value={controls.rrfWeights.dense}
              onChange={(v) => onChange({ rrfWeights: { ...controls.rrfWeights, dense: v } })}
            />
          </div>
          <p className="mt-2 px-0.5 text-[10.5px] leading-relaxed text-muted-foreground/75">
            {hybridOn ? (
              <>
                Nudging a weight <span className="font-medium text-foreground/80">reorders the
                Hybrid list</span>. The live path uses equal weights — tunable fusion is
                Lab-only.
              </>
            ) : (
              <>Enable the Hybrid channel to tune fusion weights.</>
            )}
          </p>
        </Group>

        <Divider />

        {/* ── Re-ranking baseline ── */}
        <Group label="Re-ranking" icon={FlaskConical} hint="baseline" hintTone="muted">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[12.5px] font-medium text-foreground/90">
                Hybrid + Rerank
              </span>
              <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                Cross-encoder re-scoring — <strong className="font-semibold">not</strong> in the
                live RLM path.
              </p>
            </div>
            <Switch
              checked={rerankOn}
              onCheckedChange={() => toggleRetriever('hybrid_rerank')}
              aria-label="Toggle Hybrid + Rerank baseline"
            />
          </div>
          <div className={cn('mt-3', !rerankOn && 'pointer-events-none opacity-40')}>
            <NumberSlider
              label="Rerank pool"
              value={controls.rerankPoolSize}
              min={10}
              max={150}
              step={10}
              onChange={(v) => onChange({ rerankPoolSize: v })}
              help="candidates the cross-encoder re-scores"
            />
          </div>
        </Group>

        <Divider />

        {/* ── Depth ── */}
        <Group label="Depth" icon={Gauge}>
          <div className="space-y-3">
            <NumberSlider
              label="Retrieval depth"
              suffix="k_each"
              value={controls.kEach}
              min={10}
              max={120}
              step={10}
              onChange={(v) => onChange({ kEach: v })}
              help="candidates pulled per retriever before fusion"
            />
            <NumberSlider
              label="Display depth"
              suffix="top_k"
              value={controls.topK}
              min={5}
              max={30}
              step={5}
              onChange={(v) => onChange({ topK: v })}
              help="ranked results returned per channel"
            />
          </div>
        </Group>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.07] pt-4">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <div className="flex items-center gap-2.5">
            <StatusPill status={status} />
            <button
              type="button"
              onClick={onRun}
              disabled={!isValid}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-brand py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-primary-foreground shadow-sm transition-all duration-300 ease-spring hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45"
            >
              Run
              <span className="grid h-7 w-7 place-items-center rounded-full bg-black/15 transition-transform duration-300 ease-spring group-hover:translate-x-0.5 motion-reduce:transition-none">
                {status === 'loading' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── sub-components ─────────────────────────

function Group({
  label,
  icon: Icon,
  hint,
  hintTone = 'muted',
  children,
}: {
  label: string
  icon?: LucideIcon
  hint?: string
  hintTone?: 'muted' | 'warn'
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground/70" /> : null}
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        {hint ? (
          <span
            className={cn(
              'ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]',
              hintTone === 'warn'
                ? 'bg-warning/15 text-warning'
                : 'bg-foreground/[0.05] text-muted-foreground/70',
            )}
          >
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Divider() {
  return <div className="h-px bg-foreground/[0.06]" />
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-300 ease-spring',
        active
          ? 'bg-card text-foreground shadow-card'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function RetrieverChip({
  meta,
  active,
  live,
  onClick,
}: {
  meta: { label: string; sub: string; icon: LucideIcon }
  active: boolean
  live?: boolean
  onClick: () => void
}) {
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group relative flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition-all duration-300 ease-spring active:scale-[0.97]',
        active
          ? live
            ? 'border-primary/45 bg-primary/[0.08]'
            : 'border-foreground/25 bg-foreground/[0.05]'
          : 'border-foreground/[0.08] bg-foreground/[0.015] hover:border-foreground/20',
      )}
    >
      <span className="flex w-full items-center gap-1.5">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            active ? (live ? 'text-primary' : 'text-foreground/80') : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'text-[11.5px] font-semibold',
            active ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {meta.label}
        </span>
        <span
          className={cn(
            'ml-auto h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
            active ? (live ? 'bg-primary' : 'bg-foreground/60') : 'bg-foreground/15',
          )}
        />
      </span>
      <span className="text-[9.5px] leading-tight text-muted-foreground/70">{meta.sub}</span>
      {live ? (
        <span className="absolute -top-1.5 right-1.5 rounded bg-primary px-1 py-px text-[7.5px] font-semibold uppercase tracking-[0.1em] text-primary-foreground shadow-sm">
          live
        </span>
      ) : null}
    </button>
  )
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11.5px] font-medium text-foreground/85">{label}</span>
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums',
            value === 1 ? 'text-muted-foreground' : 'text-warning',
          )}
        >
          {value.toFixed(1)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={2}
        step={0.1}
        onValueChange={([v]) => onChange(Number(v.toFixed(1)))}
        aria-label={label}
      />
    </div>
  )
}

function NumberSlider({
  label,
  suffix,
  value,
  min,
  max,
  step,
  onChange,
  help,
}: {
  label: string
  suffix?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  help?: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-medium text-foreground/85">
          {label}
          {suffix ? (
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/60">{suffix}</span>
          ) : null}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-foreground/80">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      />
      {help ? (
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground/65">{help}</p>
      ) : null}
    </div>
  )
}

const STATUS_META: Record<LabStatus, { label: string; dot: string; text: string }> = {
  idle: { label: 'Idle', dot: 'bg-foreground/25', text: 'text-muted-foreground' },
  loading: { label: 'Running', dot: 'bg-info animate-pulse', text: 'text-info' },
  done: { label: 'Done', dot: 'bg-success', text: 'text-success' },
  error: { label: 'Error', dot: 'bg-destructive', text: 'text-destructive' },
}

function StatusPill({ status }: { status: LabStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      <span className={cn('text-[10.5px] font-medium uppercase tracking-[0.1em]', meta.text)}>
        {meta.label}
      </span>
    </span>
  )
}
