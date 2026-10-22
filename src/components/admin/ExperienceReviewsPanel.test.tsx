import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ExperienceReviewsPanel } from './ExperienceReviewsPanel'

const setStatus = vi.fn()
const saveReply = vi.fn().mockResolvedValue(undefined)
let isError = false

const reviews = [
  { id: 'r1', rating: 5, comment: 'Superb', status: 'pending', created_at: 'x', owner_reply: null, reviewer_name: 'Amina K.',
    experiences: { title: 'Dhow Trip', slug: 'dhow-trip' }, profiles: { full_name: 'Amina Kamau' } },
]

vi.mock('@/features/admin/experienceReviews/queries', () => ({
  useAdminExperienceReviews: () => ({ data: isError ? undefined : reviews, isLoading: false, isError }),
  useUpdateExperienceReviewStatus: () => ({ mutate: (...a: unknown[]) => setStatus(...a) }),
  useDeleteExperienceReview: () => ({ mutate: vi.fn() }),
  useSetExperienceReviewReply: () => ({ mutateAsync: (...a: unknown[]) => saveReply(...a), isPending: false }),
}))

function renderPanel() {
  return render(<MemoryRouter><ExperienceReviewsPanel /></MemoryRouter>)
}

describe('ExperienceReviewsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isError = false
  })
  afterEach(() => cleanup())

  it('shows the review with its experience and approves or rejects it', () => {
    renderPanel()
    expect(screen.getByText('Amina Kamau')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dhow Trip' }).getAttribute('href')).toBe('/experiences/dhow-trip')
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(setStatus).toHaveBeenCalledWith({ id: 'r1', status: 'approved' })
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(setStatus).toHaveBeenCalledWith({ id: 'r1', status: 'rejected' })
  })

  it('saves a public reply', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Reply publicly/ }))
    fireEvent.change(screen.getByLabelText(/Public reply/), { target: { value: 'Asante sana!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save reply' }))
    await waitFor(() => expect(saveReply).toHaveBeenCalledWith({ id: 'r1', reply: 'Asante sana!' }))
  })

  it('points to the migration when the table is missing', () => {
    isError = true
    renderPanel()
    expect(screen.getByText(/0026_experience_reviews\.sql/)).toBeTruthy()
  })
})
