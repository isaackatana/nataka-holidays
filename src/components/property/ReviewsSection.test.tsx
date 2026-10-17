import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReviewsSection } from './ReviewsSection'

const reviews = [
  { id: 'r1', rating: 5, comment: 'Wonderful', created_at: '2026-10-01', owner_reply: 'Thank you, Amina!', profiles: { full_name: 'Amina' } },
  { id: 'r2', rating: 4, comment: 'Nice', created_at: '2026-10-02', owner_reply: null, profiles: { full_name: 'Joe' } },
]

vi.mock('@/features/reviews/queries', () => ({
  useApprovedReviews: () => ({ data: reviews, isLoading: false }),
}))

describe('ReviewsSection', () => {
  afterEach(() => cleanup())

  it('shows the business reply under only the review that has one', () => {
    render(<ReviewsSection propertyId="p1" />)
    expect(screen.getAllByText('Response from Nataka Holidays')).toHaveLength(1)
    expect(screen.getByText('Thank you, Amina!')).toBeTruthy()
  })

  it('shows how many reviews gave each star rating', () => {
    render(<ReviewsSection propertyId="p1" />)
    expect(screen.getByLabelText('5 stars: 1 review')).toBeTruthy()
    expect(screen.getByLabelText('4 stars: 1 review')).toBeTruthy()
    expect(screen.getByLabelText('3 stars: 0 reviews')).toBeTruthy()
  })
})
