import localFont from 'next/font/local'

/*
 * Self-hosted fonts (vendored woff2 under frontend/fonts/) so `next build` and
 * the running demo need zero font network — matching the project's offline-first
 * stance. Inter (variable) drives UI chrome; IBM Plex Sans Arabic renders RTL
 * legal text. Both are exposed as CSS variables consumed by tailwind.config.ts.
 */

export const fontSans = localFont({
  src: '../fonts/inter-latin-wght.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const fontArabic = localFont({
  src: [
    { path: '../fonts/ibm-plex-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/ibm-plex-arabic-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/ibm-plex-arabic-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/ibm-plex-arabic-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-arabic',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
