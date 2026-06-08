'use client'

/**
 * About (`/about`) — the editorial "face" of the demo: the thesis, its authors
 * and committee, the two novel resources, and an honest note on the demo + AI
 * usage. Everything renders from `lib/about.ts` (the single source of truth), so
 * the page is a complete static first paint and works with the backend DOWN. A
 * non-blocking `GET /api/meta` (shared `['meta']` query, AbortController-backed)
 * only OVERWRITES the resource counts when it succeeds — never blanks the page,
 * never shows an error/offline surface here.
 *
 * Design: editorial / masthead treatment built on the project's locked stack
 * (Instrument-Serif display · Inter chrome · IBM Plex Arabic · Lucide · Ink &
 * Orange/Gold tokens). From high-end-visual-design we take STRUCTURE/SPACING/
 * MOTION only — macro-whitespace, eyebrow tags, nested "double-bezel" cards,
 * button-in-button CTAs, spring-eased scroll reveals (reduced-motion-safe).
 */

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  BookText,
  FlaskConical,
  Gavel,
  GraduationCap,
  Quote,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { getMeta } from '@/lib/api'
import type { Meta } from '@/lib/types'
import { fmtInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/use-pipeline-stream'
import { AuroraBackdrop } from '@/components/shared/aurora-backdrop'
import { ArabicText } from '@/components/shared/arabic-text'
import { Badge } from '@/components/ui/badge'
import {
  AI_USAGE,
  ARABIC_TERM,
  ARABIC_TERM_GLOSS,
  AUTHORS,
  DEMO_PURPOSE,
  HEADLINE_METRICS,
  HEADLINE_STATS,
  HERO_LINE,
  IMPROVEMENT_NOTE,
  INSTITUTION,
  JURY,
  LINKS,
  MOTIVATION,
  ONE_LINER,
  RESOURCES,
  SYSTEM_IN_BRIEF,
  SYSTEM_NAME,
  THESIS_TITLE,
  VIVA_DATE,
  type HeadlineMetric,
  type JuryMember,
  type JuryRole,
  type LiveStat,
  type Resource,
} from '@/lib/about'

// ───────────────────────── live /api/meta (silent enrichment) ─────────────────────────

/** Shares the `['meta']` cache with the rest of the app; failures stay silent so
 *  the static fallbacks just remain in place (offline-first). */
function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => getMeta(signal),
    staleTime: 60_000,
    retry: false,
  })
}

/** Live count if present & finite, else the baked-in static fallback. kg_triples
 *  is `number | null` — the typeof guard handles the null. */
function statValue(meta: Meta | undefined, stat: LiveStat): number {
  const v = meta?.[stat.field]
  return typeof v === 'number' && Number.isFinite(v) ? v : stat.fallback
}

// ───────────────────────── primitives ─────────────────────────

/** Scroll-reveal wrapper (transform+opacity only). Reduced-motion → shows
 *  instantly; above-fold callers pass `instant` so first paint is never blank. */
function Reveal({
  children,
  className,
  delay = 0,
  instant = false,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  instant?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = React.useState(instant)

  React.useEffect(() => {
    if (instant || reduced) {
      setShown(true)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [instant, reduced])

  return (
    <div
      ref={ref}
      style={shown && !reduced ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-all duration-700 ease-spring motion-reduce:transition-none',
        shown
          ? 'translate-y-0 opacity-100 blur-0'
          : 'translate-y-4 opacity-0 blur-[2px]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** The project's "machined" double-bezel: hairline tray (outer) + concentric
 *  inner core. Mirrors the idiom already used across the pipeline pages. */
function Bezel({
  children,
  className,
  innerClassName,
}: {
  children: React.ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.08] dark:bg-foreground/[0.025] dark:ring-foreground/[0.06]',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-[1.4rem] bg-card/70 p-6 shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]',
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Section header: tiny kicker → big serif title → optional lead. */
function SectionHeader({
  kicker,
  title,
  lead,
}: {
  kicker: string
  title: string
  lead?: string
}) {
  return (
    <div className="max-w-2xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
        {kicker}
      </div>
      <h2 className="mt-3 font-display text-3xl tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-3 text-balance leading-relaxed text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </div>
  )
}

/** Button-in-button CTA: pill with a nested circular trailing icon that drifts
 *  on hover (magnetic micro-interaction), spring-eased. */
function CtaLink({
  href,
  children,
  primary = false,
}: {
  href: string
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full py-2 pl-4 pr-2 text-sm font-medium transition-all duration-300 ease-spring active:scale-[0.98]',
        primary
          ? 'bg-gradient-brand text-primary-foreground shadow-sm hover:brightness-110'
          : 'border border-foreground/12 bg-foreground/[0.03] text-foreground/85 hover:border-foreground/25',
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          'grid h-7 w-7 place-items-center rounded-full transition-transform duration-300 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105',
          primary ? 'bg-black/10 text-current' : 'bg-foreground/[0.06] text-foreground/70',
        )}
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

const SECTION = 'mx-auto w-full max-w-[1080px] px-6'

// ───────────────────────── jury ─────────────────────────

const ROLE_VARIANT: Record<
  JuryRole,
  React.ComponentProps<typeof Badge>['variant']
> = {
  President: 'info',
  Supervisor: 'default',
  'Co-supervisor': 'gold',
  Examiner: 'muted',
}

function JuryCard({ member }: { member: JuryMember }) {
  return (
    <Bezel innerClassName="flex h-full flex-col gap-2 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="font-display text-xl tracking-tight text-foreground">
          {member.name}
        </div>
        <Badge variant={ROLE_VARIANT[member.role]} className="shrink-0">
          {member.role}
        </Badge>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground/80">{member.grade}</span>
        <span aria-hidden className="text-foreground/25">
          ·
        </span>
        <span>{member.affiliation}</span>
        <span aria-hidden className="text-foreground/25">
          ·
        </span>
        <span>{member.country}</span>
      </div>
    </Bezel>
  )
}

// ───────────────────────── resource card ─────────────────────────

function ResourceCard({ resource, meta }: { resource: Resource; meta: Meta | undefined }) {
  const value = statValue(meta, resource.stat)
  return (
    <Bezel innerClassName="flex h-full flex-col gap-4 p-6 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          {resource.kicker}
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground/[0.05] text-foreground/70 ring-1 ring-foreground/10">
          {resource.kicker.includes('I') && !resource.kicker.includes('II') ? (
            <BookText className="h-4 w-4" />
          ) : (
            <FlaskConical className="h-4 w-4" />
          )}
        </span>
      </div>

      <h3 className="font-display text-2xl leading-tight tracking-tight text-foreground">
        {resource.name}
      </h3>

      <div className="flex items-baseline gap-2">
        <span className="nums font-display text-4xl tracking-tight text-gradient-brand">
          {fmtInt(value)}
        </span>
        <span className="text-sm text-muted-foreground">{resource.stat.label.toLowerCase()}</span>
      </div>

      <p className="text-balance text-sm leading-relaxed text-muted-foreground">
        {resource.blurb}
      </p>

      <ul className="space-y-1.5">
        {resource.facts.map((fact) => (
          <li key={fact} className="flex gap-2 text-xs leading-relaxed text-muted-foreground/85">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
            <span>{fact}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-1">
        <CtaLink href={resource.href}>{resource.hrefLabel}</CtaLink>
      </div>
    </Bezel>
  )
}

// ───────────────────────── headline metric tile ─────────────────────────

const METRIC_BAR: Record<HeadlineMetric['accent'], string> = {
  default: 'bg-primary',
  success: 'bg-success',
  gold: 'bg-gold',
  info: 'bg-info',
}

function MetricTile({ metric }: { metric: HeadlineMetric }) {
  return (
    <Link
      href="/results"
      className="group relative block overflow-hidden rounded-[1.2rem] border border-foreground/10 bg-card/60 p-5 shadow-card transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-card-hover"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', METRIC_BAR[metric.accent])} aria-hidden />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {metric.label}
      </div>
      <div className="nums mt-2 font-display text-4xl tracking-tight text-foreground">
        {metric.value}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{metric.blurb}</p>
    </Link>
  )
}

// ───────────────────────── page ─────────────────────────

export default function AboutPage() {
  const { data: meta } = useMeta()

  return (
    <div className="relative pb-24">
      {/* ── 1 · Masthead ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <AuroraBackdrop soft />
        <div className={cn(SECTION, 'pt-14 md:pt-20')}>
          <div className="motion-safe:animate-fade-up motion-reduce:animate-none">
            <div className="flex flex-wrap items-center gap-2.5">
              <Eyebrow>
                <GraduationCap className="h-3 w-3 text-primary" />
                {INSTITUTION.short} · {INSTITUTION.englishName}
              </Eyebrow>
              <Eyebrow>Viva {VIVA_DATE}</Eyebrow>
              <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1">
                <ArabicText as="span" className="text-sm leading-none text-foreground/80">
                  {ARABIC_TERM}
                </ArabicText>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {ARABIC_TERM_GLOSS}
                </span>
              </span>
            </div>

            <div className="mt-7 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
                <Scale className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono text-sm font-medium uppercase tracking-[0.3em] text-gradient-brand">
                {SYSTEM_NAME}
              </span>
            </div>

            <h1 className="mt-4 max-w-4xl text-balance font-display text-5xl leading-[1.02] tracking-tight text-foreground md:text-7xl">
              {HERO_LINE}
            </h1>

            <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
              {ONE_LINER}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">
              <CtaLink href="/" primary>
                See it reason
              </CtaLink>
              <CtaLink href="/results">Read the results</CtaLink>
              <span className="text-sm text-muted-foreground">
                by{' '}
                <span className="font-medium text-foreground/85">
                  {AUTHORS.map((a) => a.name).join(' & ')}
                </span>
              </span>
            </div>
          </div>

          {/* Dissertation title — cited beneath the hero */}
          <div className="mt-10 motion-safe:animate-fade-up motion-reduce:animate-none">
            <div className="flex max-w-3xl gap-4 rounded-[1.4rem] border border-foreground/10 bg-foreground/[0.025] p-5">
              <Quote className="h-5 w-5 shrink-0 text-primary/70" aria-hidden />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                  Dissertation
                </div>
                <p className="mt-1 font-display text-lg leading-snug text-foreground/85">
                  {THESIS_TITLE}
                </p>
              </div>
            </div>
          </div>

          {/* Headline corpus/KG stats — live /api/meta with static fallbacks */}
          <div className="mt-10 grid grid-cols-2 gap-3 motion-safe:animate-fade-up motion-reduce:animate-none md:grid-cols-4">
            {HEADLINE_STATS.map((stat) => (
              <Link
                key={stat.field}
                href={stat.href}
                className="group rounded-[1.1rem] border border-foreground/10 bg-card/50 px-4 py-4 transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card/80"
              >
                <div className="nums font-display text-3xl tracking-tight text-foreground">
                  {fmtInt(statValue(meta, stat))}
                </div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2 · Motivation ───────────────────────────────────────── */}
      <section className={cn(SECTION, 'pt-24 md:pt-28')}>
        <Reveal>
          <SectionHeader
            kicker="Motivation"
            title="Why citation-faithfulness"
          />
        </Reveal>
        <div className="mt-8 grid gap-x-12 gap-y-6 md:grid-cols-[1fr_minmax(0,42ch)]">
          <div className="space-y-5">
            {MOTIVATION.map((para, i) => (
              <Reveal key={i} delay={i * 60}>
                <p
                  className={cn(
                    'text-balance leading-relaxed',
                    i === 0
                      ? 'text-lg text-foreground/90'
                      : 'text-muted-foreground',
                  )}
                >
                  {para}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120} className="md:pt-1">
            <Bezel innerClassName="flex h-full flex-col justify-center gap-3 p-6">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              <p className="font-display text-xl leading-snug text-foreground">
                A triple faithfulness gate: citation existence, jurisdictional
                discipline, and claim-level support.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Every answer must clear all three — or the system abstains.
              </p>
            </Bezel>
          </Reveal>
        </div>
      </section>

      {/* ── 3 · The system in brief + headline metrics ───────────── */}
      <section className={cn(SECTION, 'pt-24 md:pt-28')}>
        <Reveal>
          <SectionHeader
            kicker="The system"
            title="What it actually does"
            lead={SYSTEM_IN_BRIEF}
          />
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HEADLINE_METRICS.map((metric, i) => (
            <Reveal key={metric.label} delay={i * 70}>
              <MetricTile metric={metric} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={80}>
          <div className="mt-6 flex flex-col gap-4 rounded-[1.4rem] border border-foreground/10 bg-foreground/[0.025] p-6 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-gold" aria-hidden />
              {IMPROVEMENT_NOTE}
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <CtaLink href="/architecture">See the architecture</CtaLink>
              <CtaLink href="/results">All results</CtaLink>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── 4 · The two novel resources ──────────────────────────── */}
      <section className={cn(SECTION, 'pt-24 md:pt-28')}>
        <Reveal>
          <SectionHeader
            kicker="Resources"
            title="Two things that didn’t exist before"
            lead="The work rests on two artefacts built from scratch for Algerian law — both browsable in this demo."
          />
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {RESOURCES.map((resource, i) => (
            <Reveal key={resource.name} delay={i * 90}>
              <ResourceCard resource={resource} meta={meta} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 5 · Authorship & committee ───────────────────────────── */}
      <section className={cn(SECTION, 'pt-24 md:pt-28')}>
        <Reveal>
          <SectionHeader
            kicker="Authorship"
            title="The authors & the committee"
            lead={`${INSTITUTION.degree} ${INSTITUTION.name} (${INSTITUTION.short}), ${INSTITUTION.department}.`}
          />
        </Reveal>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {AUTHORS.map((author, i) => (
            <Reveal key={author.name} delay={i * 70}>
              <Bezel innerClassName="flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-sm">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-display text-xl tracking-tight text-foreground">
                    {author.name}
                  </div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Author
                  </div>
                </div>
              </Bezel>
            </Reveal>
          ))}
        </div>

        <Reveal delay={60}>
          <div className="mt-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Gavel className="h-3.5 w-3.5 text-primary" aria-hidden />
            Jury · defended publicly {VIVA_DATE}
          </div>
        </Reveal>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {JURY.map((member, i) => (
            <Reveal key={member.name} delay={i * 60}>
              <JuryCard member={member} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 6 · Demo purpose + AI usage ──────────────────────────── */}
      <section className={cn(SECTION, 'pt-24 md:pt-28')}>
        <Reveal>
          <SectionHeader kicker="Honesty" title="About this demo" />
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal>
            <Bezel innerClassName="flex h-full flex-col gap-3 p-6">
              <Sparkles className="h-5 w-5 text-gold" aria-hidden />
              <h3 className="font-display text-xl tracking-tight text-foreground">
                A demo, not a chatbot
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {DEMO_PURPOSE}
              </p>
            </Bezel>
          </Reveal>
          <Reveal delay={90}>
            <Bezel innerClassName="flex h-full flex-col gap-3 p-6">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="font-display text-xl tracking-tight text-foreground">
                AI-usage & integrity
              </h3>
              {AI_USAGE.map((para) => (
                <p key={para} className="text-sm leading-relaxed text-muted-foreground">
                  {para}
                </p>
              ))}
            </Bezel>
          </Reveal>
        </div>
      </section>

      {/* ── 7 · Explore / colophon ───────────────────────────────── */}
      <section className={cn(SECTION, 'pt-24 md:pt-28')}>
        <Reveal>
          <SectionHeader kicker="Explore" title="Where to go next" />
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((link, i) => (
            <Reveal key={link.href} delay={(i % 3) * 70}>
              <Link
                href={link.href}
                className="group flex h-full items-start justify-between gap-3 rounded-[1.2rem] border border-foreground/10 bg-card/50 p-5 transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card/80"
              >
                <div>
                  <div className="font-medium text-foreground">{link.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{link.blurb}</div>
                </div>
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-foreground/60 transition-transform duration-300 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-6 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">{SYSTEM_NAME}</span>
            <span aria-hidden className="text-foreground/25">·</span>
            <span>{INSTITUTION.short}</span>
            <span aria-hidden className="text-foreground/25">·</span>
            <span>{INSTITUTION.country}</span>
            <span aria-hidden className="text-foreground/25">·</span>
            <span>Ref. {INSTITUTION.reference}</span>
            <span aria-hidden className="text-foreground/25">·</span>
            <span>Viva {VIVA_DATE}</span>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
