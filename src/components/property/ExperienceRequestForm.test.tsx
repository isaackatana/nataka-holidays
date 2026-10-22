import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ExperienceRequestForm } from './ExperienceRequestForm'
import type { Experience } from '@/types/domain'

const mutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, profile: null }),
}))
vi.mock('@/features/experienceRequests/queries', () => ({
  useSubmitExperienceRequest: () => ({ mutateAsync: (...a: unknown[]) => mutateAsync(...a) }),
}))

const experience = {
  id: 'e1', title: 'Dhow Trip', slug: 'dhow-trip', description: 'd', location: null,
  price: 5000, price_type: 'per_person', max_group_size: 6, duration: null, video_url: null,
  is_published: true, created_at: '', updated_at: '',
} as Experience

function fill(date = '2099-01-01', people = '3') {
  fireEvent.change(screen.getByLabelText('Preferred date'), { target: { value: date } })
  fireEvent.change(screen.getByLabelText('Number of people'), { target: { value: people } })
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Amina Kamau' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'amina@example.com' } })
  fireEvent.change(screen.getByLabelText('Phone / WhatsApp'), { target: { value: '0712345678' } })
}

describe('ExperienceRequestForm', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('shows the estimated total as the group size changes', () => {
    render(<ExperienceRequestForm experience={experience} />)
    fill('2099-01-01', '3')
    expect(screen.getByText(/15,000/)).toBeTruthy()
  })

  it('sends the request with the details entered and then confirms', async () => {
    render(<ExperienceRequestForm experience={experience} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      experienceId: 'e1', guestName: 'Amina Kamau', guestEmail: 'amina@example.com',
      guestPhone: '0712345678', preferredDate: '2099-01-01', people: 3,
    })
    await waitFor(() => expect(screen.getByText('Request sent')).toBeTruthy())
  })

  it('asks for a date and does not send an incomplete form', async () => {
    render(<ExperienceRequestForm experience={experience} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(screen.getByText('Choose a date')).toBeTruthy())
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('refuses a group larger than the experience allows', async () => {
    render(<ExperienceRequestForm experience={experience} />)
    fill('2099-01-01', '9')
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(screen.getByText('This experience takes at most 6 people.')).toBeTruthy())
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it("shows the database's own message when it refuses (for example a passed date)", async () => {
    mutateAsync.mockRejectedValueOnce({ code: '23514', message: 'Please choose a date that has not passed.' })
    render(<ExperienceRequestForm experience={experience} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(screen.getByText('Please choose a date that has not passed.')).toBeTruthy())
  })

  it('does not claim an estimate when the price basis is not set', () => {
    render(<ExperienceRequestForm experience={{ ...experience, price_type: null }} />)
    fill('2099-01-01', '3')
    expect(screen.getByText(/We'll confirm the total for your group/)).toBeTruthy()
    expect(screen.queryByText(/15,000/)).toBeNull()
  })
})
