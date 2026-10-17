import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PendingReviewsNotice } from './PendingReviewsNotice'

let count: number | undefined

vi.mock('@/features/admin/reviews/queries', () => ({
  usePendingReviewCount: () => ({ data: count }),
}))

function renderNotice() {
  return render(
    <MemoryRouter>
      <PendingReviewsNotice />
    </MemoryRouter>,
  )
}

describe('PendingReviewsNotice', () => {
  afterEach(() => cleanup())

  it('links to the reviews page with the count', () => {
    count = 3
    renderNotice()
    expect(screen.getByText('3 reviews')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/admin/reviews')
  })

  it('uses the singular for one review', () => {
    count = 1
    renderNotice()
    expect(screen.getByText('1 review')).toBeTruthy()
  })

  it('shows nothing when none are waiting', () => {
    count = 0
    const { container } = renderNotice()
    expect(container.textContent).toBe('')
    cleanup()
    count = undefined
    expect(renderNotice().container.textContent).toBe('')
  })
})
