/**
 * Scroll-to-anchor helper shared by both reading panes (client/DOM only).
 *
 * Why a settle loop: the panes use `content-visibility:auto`, so a far target's
 * offset is first computed from the *estimated* `contain-intrinsic-size`. As the
 * intervening Arabic blocks render their real (variable) heights, the target
 * drifts. We re-center across a few animation frames until its viewport position
 * stops moving — this is what makes the deep-link land precisely on the 1000+
 * article documents. Near, already-visible targets get a single smooth scroll.
 */

function isFullyVisible(el: HTMLElement, container: HTMLElement | null): boolean {
  const er = el.getBoundingClientRect()
  if (container) {
    const cr = container.getBoundingClientRect()
    return er.top >= cr.top && er.bottom <= cr.bottom
  }
  return er.top >= 0 && er.bottom <= window.innerHeight
}

export function settleScroll(
  el: HTMLElement | null | undefined,
  container: HTMLElement | null,
  reduceMotion: boolean,
): void {
  if (!el) return

  if (!reduceMotion && isFullyVisible(el, container)) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }

  let lastTop = Number.NaN
  let tries = 0
  const run = () => {
    el.scrollIntoView({ block: 'center', behavior: 'auto' })
    const top = el.getBoundingClientRect().top
    tries += 1
    if (tries < 4 && Math.abs(top - lastTop) > 2) {
      lastTop = top
      requestAnimationFrame(run)
    }
  }
  requestAnimationFrame(run)
}

/** Respect the user's reduced-motion preference (SSR-safe). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
