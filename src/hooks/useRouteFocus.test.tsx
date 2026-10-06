// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { useRouteFocus } from './useRouteFocus'

afterEach(cleanup)

let go: (to: string) => void = () => {}

function Page() {
  useRouteFocus()
  const navigate = useNavigate()
  go = (to) => navigate(to)
  return (
    <main id="main-content" tabIndex={-1}>
      page
    </main>
  )
}

describe('useRouteFocus', () => {
  it('moves focus to main and scrolls to top on a new path, but not on first load or query-only changes', () => {
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    const { container } = render(
      <MemoryRouter initialEntries={['/stays']}>
        <Page />
      </MemoryRouter>,
    )
    const main = container.querySelector('#main-content')
    expect(document.activeElement).not.toBe(main) // first load: leave focus alone
    expect(scrollTo).not.toHaveBeenCalled()

    act(() => go('/stays?beds=2')) // filtering a list
    expect(document.activeElement).not.toBe(main)
    expect(scrollTo).not.toHaveBeenCalled()

    act(() => go('/stays/beach-villa')) // real navigation
    expect(document.activeElement).toBe(main)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
