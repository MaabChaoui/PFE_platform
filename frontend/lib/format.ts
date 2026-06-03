/**
 * Display formatting helpers shared across pages (MetricCard, telemetry,
 * Results, Benchmark). Pure functions — safe to unit-test and use anywhere.
 */

/** A 0..1 score (F1, precision, recall) → 3-decimal string, e.g. 0.3045 → "0.305". */
export function fmtScore(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

/** A 0..1 ratio → percent string, e.g. 0.703 → "70.3%". */
export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

/** Latency seconds → compact human string, e.g. 9.74 → "9.7s", 0.42 → "420ms". */
export function fmtLatency(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

/** Integer with thousands separators, e.g. 765215 → "765,215". */
export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

/** Multiplier, e.g. 2.9 → "2.9×". */
export function fmtFactor(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}×`
}

/** Truncate to n chars on a word boundary with an ellipsis. */
export function truncate(text: string, n: number): string {
  if (text.length <= n) return text
  const slice = text.slice(0, n)
  const lastSpace = slice.lastIndexOf(' ')
  return `${(lastSpace > n * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`
}

/** Title-case a snake_case / kebab label, e.g. "rule_application" → "Rule Application". */
export function humanize(label: string): string {
  return label
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
