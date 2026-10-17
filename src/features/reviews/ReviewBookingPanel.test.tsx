import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReviewBookingPanel } from './ReviewBookingPanel'

const submitReview = vi.fn().mockResolvedValue(undefined)
const updateMyReview = vi.fn().mockResolvedValue(undefined)
const uploadReviewImage = vi.fn().mockResolvedValue(undefined)
const deleteReviewImage = vi.fn().mockResolvedValue(undefined)

vi.mock('@/services/reviews.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/reviews.service')>(
    '@/services/reviews.service',
  )
  return {
    ...actual,
    submitReview: (...a: unknown[]) => submitReview(...a),
    updateMyReview: (...a: unknown[]) => updateMyReview(...a),
    uploadReviewImage: (...a: unknown[]) => uploadReviewImage(...a),
    deleteReviewImage: (...a: unknown[]) => deleteReviewImage(...a),
  }
})

function renderPanel(review?: Parameters<typeof ReviewBookingPanel>[0]['review']) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <ReviewBookingPanel customerId="u1" bookingId="b1" propertyId="p1" review={review} />
    </QueryClientProvider>,
  )
}

describe('ReviewBookingPanel', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('requires a star rating before submitting', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(screen.getByText('Please choose a star rating.')).toBeTruthy()
    expect(submitReview).not.toHaveBeenCalled()
  })

  it('submits a rating and comment for the booking', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    fireEvent.change(screen.getByLabelText('Your comments (optional)'), {
      target: { value: 'Lovely stay' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(1))
    expect(submitReview.mock.calls[0][0]).toMatchObject({
      customerId: 'u1',
      propertyId: 'p1',
      bookingId: 'b1',
      rating: 4,
      comment: 'Lovely stay',
    })
  })

  it('shows an existing review with its moderation status and lets it be edited', () => {
    renderPanel({
      id: 'r1',
      booking_id: 'b1',
      property_id: 'p1',
      rating: 5,
      comment: 'Great',
      status: 'pending',
      created_at: '2026-10-01',
      review_images: [],
    })
    expect(screen.getByText('Awaiting approval')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit your review' }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })

  it('uploads picked photos against the new review after saving it', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    const photo = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('review-photo-input'), { target: { files: [photo] } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    await waitFor(() => expect(uploadReviewImage).toHaveBeenCalledTimes(1))
    const reviewId = submitReview.mock.calls[0][0].id
    expect(uploadReviewImage).toHaveBeenCalledWith('u1', reviewId, photo)
  })

  it('refuses a non-image file with a message', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    renderPanel()
    const pdf = new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByTestId('review-photo-input'), { target: { files: [pdf] } })
    expect(screen.getByText(/Only JPEG, PNG or WebP/)).toBeTruthy()
    expect(uploadReviewImage).not.toHaveBeenCalled()
  })
})
