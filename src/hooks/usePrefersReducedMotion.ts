import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function getInitial(): boolean {
  // matchMedia doesn't exist in a non-browser environment (SSR, tests
  // without jsdom's implementation) — default to false (motion allowed)
  // rather than throw.
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(getInitial)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQueryList = window.matchMedia(QUERY)

    function handleChange(e: MediaQueryListEvent) {
      setPrefersReduced(e.matches)
    }

    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [])

  return prefersReduced
}
