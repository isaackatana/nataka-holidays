import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ExperienceReviewsSection } from './ExperienceReviewsSection'

let reviews: unknown[] | undefined

vi.mock('@/features/experienceReviews/queries', () => ({
  useApprovedExperienceReviews: () => ({ data: reviews }),
}))

describe('ExperienceReviewsSection', () => {
  afterEach(() => cleanup())

  it('shows the average, the breakdown, the names and the business reply', () => {
    reviews = [
      { id: '1', rating: 5, comment: 'Superb', created_at: 'x', owner_reply: 'Asante!', reviewer_name: 'Amina K.' },
      { id: '2', rating: 4, comment: 'Good', created_at: 'x', owner_reply: null, reviewer_name: null },
    ]
    render(<ExperienceReviewsSection experienceId="e1" />)
    expect(screen.getByText('4.5')).toBeTruthy()
    expect(screen.getByText('(2 reviews)')).toBeTruthy()
    expect(screen.getByLabelText('5 stars: 1 review')).toBeTruthy()
    expect(screen.getByText('Amina K.')).toBeTruthy()
    expect(screen.getByText('Guest')).toBeTruthy()
    expect(screen.getAllByText('Response from Nataka Holidays')).toHaveLength(1)
  })

  it('is left out entirely when there are no approved reviews', () => {
    reviews = []
    expect(render(<ExperienceReviewsSection experienceId="e1" />).container.textContent).toBe('')
    cleanup()
    reviews = undefined
    expect(render(<ExperienceReviewsSection experienceId="e1" />).container.textContent).toBe('')
  })
})
