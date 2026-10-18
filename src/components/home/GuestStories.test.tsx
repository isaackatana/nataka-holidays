import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GuestStories } from './GuestStories'

let reviews: unknown[] | undefined

vi.mock('@/features/reviews/queries', () => ({
  useFeaturedReviews: () => ({ data: reviews }),
}))

function renderSection() {
  return render(
    <MemoryRouter>
      <GuestStories />
    </MemoryRouter>,
  )
}

describe('GuestStories', () => {
  afterEach(() => cleanup())

  it('shows real reviews with the guest name and a link to the property', () => {
    reviews = [
      { id: 'r1', rating: 5, comment: 'Wonderful stay', created_at: 'x', reviewer_name: 'Amina K.', properties: { title: 'Beach Villa', slug: 'beach-villa' } },
      { id: 'r2', rating: 4, comment: 'Very nice', created_at: 'x', reviewer_name: null, properties: null },
    ]
    renderSection()
    expect(screen.getByText('What guests are saying')).toBeTruthy()
    expect(screen.getByText('Amina K.')).toBeTruthy()
    expect(screen.getByText('Guest')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Beach Villa' }).getAttribute('href')).toBe('/stays/beach-villa')
    expect(screen.getByLabelText('5 out of 5 stars')).toBeTruthy()
  })

  it('leaves the whole section out when there are no reviews, or they have not loaded', () => {
    reviews = []
    expect(renderSection().container.textContent).toBe('')
    cleanup()
    reviews = undefined
    expect(renderSection().container.textContent).toBe('')
  })
})
