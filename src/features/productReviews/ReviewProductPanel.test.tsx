import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ReviewProductPanel } from './ReviewProductPanel'

const submit = vi.fn().mockResolvedValue(undefined)
const update = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/productReviews/queries', () => ({
  useSubmitProductReview: () => ({ mutateAsync: (...a: unknown[]) => submit(...a), isPending: false }),
  useUpdateMyProductReview: () => ({ mutateAsync: (...a: unknown[]) => update(...a), isPending: false }),
}))

const base = { customerId: 'u1', productId: 'e1', orderId: 'r1' }

describe('ReviewProductPanel', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('needs a star rating before submitting', () => {
    render(<ReviewProductPanel {...base} review={undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(screen.getByText('Please choose a star rating.')).toBeTruthy()
    expect(submit).not.toHaveBeenCalled()
  })

  it('submits the rating and comment for that request', async () => {
    render(<ReviewProductPanel {...base} review={undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.change(screen.getByLabelText('Your comments (optional)'), { target: { value: 'Brilliant dhow trip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    expect(submit.mock.calls[0][0]).toEqual({
      customerId: 'u1', productId: 'e1', orderId: 'r1', rating: 5, comment: 'Brilliant dhow trip',
    })
  })

  it('shows an existing review with its status and lets it be edited', async () => {
    render(
      <ReviewProductPanel
        {...base}
        review={{ id: 'rv1', order_id: 'r1', product_id: 'e1', rating: 4, comment: 'Nice', status: 'pending', created_at: 'x' }}
      />,
    )
    expect(screen.getByText('Awaiting approval')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit your review' }))
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith({ id: 'rv1', rating: 5, comment: 'Nice' }))
  })

  it('shows a message when saving fails', async () => {
    submit.mockRejectedValueOnce(new Error('nope'))
    render(<ReviewProductPanel {...base} review={undefined} />)
    fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    await waitFor(() => expect(screen.getByText("We couldn't save your review. Please try again.")).toBeTruthy())
  })
})
