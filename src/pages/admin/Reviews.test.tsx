import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminReviews from './Reviews'

const mutateAsync = vi.fn().mockResolvedValue(undefined)

const reviews = [
  { id: 'r1', rating: 5, comment: 'Wonderful', status: 'approved', created_at: '2026-10-01', owner_reply: null,
    properties: { title: 'Beach Villa', slug: 'beach-villa' }, profiles: { full_name: 'Amina' } },
  { id: 'r2', rating: 4, comment: 'Nice', status: 'approved', created_at: '2026-10-02', owner_reply: 'Thanks Joe',
    properties: { title: 'Beach Villa', slug: 'beach-villa' }, profiles: { full_name: 'Joe' } },
]

vi.mock('@/features/admin/experienceReviews/queries', () => ({
  usePendingExperienceReviewCount: () => ({ data: 0 }),
  useAdminExperienceReviews: () => ({ data: [], isLoading: false, isError: false }),
  useUpdateExperienceReviewStatus: () => ({ mutate: vi.fn() }),
  useDeleteExperienceReview: () => ({ mutate: vi.fn() }),
  useSetExperienceReviewReply: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/features/admin/reviews/queries', () => ({
  usePendingReviewCount: () => ({ data: 0 }),
  useAdminReviews: () => ({ data: reviews, isLoading: false }),
  useUpdateReviewStatus: () => ({ mutate: vi.fn() }),
  useDeleteReview: () => ({ mutate: vi.fn() }),
  useSetOwnerReply: () => ({ mutateAsync: (...a: unknown[]) => mutateAsync(...a), isPending: false }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminReviews />
    </MemoryRouter>,
  )
}

describe('AdminReviews replies', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('saves a new public reply', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Reply publicly/ }))
    fireEvent.change(screen.getByLabelText(/Public reply/), { target: { value: 'Asante sana!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save reply' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 'r1', reply: 'Asante sana!' }))
  })

  it('shows an existing reply and can remove it', async () => {
    renderPage()
    expect(screen.getByText('Thanks Joe')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Edit reply/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove reply' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 'r2', reply: '' }))
  })

  it('does not allow saving an empty reply', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Reply publicly/ }))
    expect((screen.getByRole('button', { name: 'Save reply' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
