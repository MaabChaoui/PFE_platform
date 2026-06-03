'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

/*
 * Presenter mode — a second theming axis (orthogonal to light/dark) that scales
 * the UI up for a projector at the viva. State lives in a `data-presenter`
 * attribute on <html>; a pre-paint inline script in app/layout.tsx sets it from
 * localStorage BEFORE first paint to avoid a flash (FOUC) / hydration mismatch,
 * so this provider only mirrors + mutates it.
 */

const STORAGE_KEY = 'presenter-mode'

type PresenterContextValue = {
  presenter: boolean
  toggle: () => void
  setPresenter: (value: boolean) => void
}

const PresenterContext = createContext<PresenterContextValue | null>(null)

function isPresenterActive(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.presenter === 'true'
}

export function PresenterProvider({ children }: { children: React.ReactNode }) {
  // Start false to match SSR markup; sync to the real (pre-paint) value on mount.
  const [presenter, setPresenterState] = useState(false)

  useEffect(() => {
    setPresenterState(isPresenterActive())
  }, [])

  const setPresenter = useCallback((value: boolean) => {
    const el = document.documentElement
    if (value) el.dataset.presenter = 'true'
    else delete el.dataset.presenter
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
    } catch {
      /* private mode / storage disabled — ignore */
    }
    setPresenterState(value)
  }, [])

  const toggle = useCallback(() => {
    setPresenter(!isPresenterActive())
  }, [setPresenter])

  return (
    <PresenterContext.Provider value={{ presenter, toggle, setPresenter }}>
      {children}
    </PresenterContext.Provider>
  )
}

export function usePresenter(): PresenterContextValue {
  const ctx = useContext(PresenterContext)
  if (!ctx) {
    throw new Error('usePresenter must be used within a PresenterProvider')
  }
  return ctx
}
