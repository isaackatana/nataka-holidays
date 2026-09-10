import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

afterEach(() => {
  cleanup()
  // @ts-expect-error -- deliberately removing the mock between tests,
  // matching jsdom's real default of matchMedia not existing at all.
  delete window.matchMedia
  vi.restoreAllMocks()
})

/** Builds a fake MediaQueryList and returns it plus a function to
 * trigger a 'change' event, since jsdom has no real implementation of
 * matchMedia to test against. */
function mockMatchMedia(initialMatches: boolean) {
  let changeHandler: ((e: MediaQueryListEvent) => void) | null = null
  const mql = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((event: string, handler: typeof changeHandler) => {
      if (event === 'change') changeHandler = handler
    }),
    removeEventListener: vi.fn(),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return {
    mql,
    triggerChange: (matches: boolean) => {
      mql.matches = matches
      changeHandler?.({ matches } as MediaQueryListEvent)
    },
  }
}

function TestComponent() {
  const prefersReduced = usePrefersReducedMotion()
  return <span data-testid="value">{prefersReduced ? 'reduced' : 'normal'}</span>
}

describe('usePrefersReducedMotion', () => {
  it('returns false when window.matchMedia does not exist (jsdom default, or a non-browser environment)', () => {
    // No mock installed — this is jsdom's real, unmodified state.
    render(<TestComponent />)
    expect(screen.getByTestId('value').textContent).toBe('normal')
  })

  it('reflects an initial matches: true from matchMedia', () => {
    mockMatchMedia(true)
    render(<TestComponent />)
    expect(screen.getByTestId('value').textContent).toBe('reduced')
  })

  it('reflects an initial matches: false from matchMedia', () => {
    mockMatchMedia(false)
    render(<TestComponent />)
    expect(screen.getByTestId('value').textContent).toBe('normal')
  })

  it('updates live when the OS-level setting changes while the page is open', () => {
    const { triggerChange } = mockMatchMedia(false)
    render(<TestComponent />)
    expect(screen.getByTestId('value').textContent).toBe('normal')

    act(() => {
      triggerChange(true)
    })
    expect(screen.getByTestId('value').textContent).toBe('reduced')

    act(() => {
      triggerChange(false)
    })
    expect(screen.getByTestId('value').textContent).toBe('normal')
  })

  it('removes the change listener on unmount', () => {
    const { mql } = mockMatchMedia(false)
    const { unmount } = render(<TestComponent />)
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
