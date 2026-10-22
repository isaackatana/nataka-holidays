import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AdminExperienceRequests from './ExperienceRequests'

const mutate = vi.fn()
const requests = [
  { id: 'r1', experience_id: 'e1', experience_title: 'Dhow Trip', guest_name: 'Amina Kamau', guest_email: 'a@x.com',
    guest_phone: '0712345678', preferred_date: '2026-12-01', people: 3, message: 'Vegetarian please',
    price_type: 'per_person', unit_price: 5000, estimated_total: 15000, status: 'new', customer_id: null, created_at: 'x' },
  { id: 'r2', experience_id: 'e1', experience_title: 'Dhow Trip', guest_name: 'Joe', guest_email: 'j@x.com',
    guest_phone: 'not a phone', preferred_date: '2026-12-02', people: 1, message: null,
    price_type: null, unit_price: null, estimated_total: null, status: 'confirmed', customer_id: null, created_at: 'x' },
]

vi.mock('@/components/admin/ExperienceRequestPayments', () => ({
  ExperienceRequestPayments: () => null,
}))
vi.mock('@/features/admin/experienceRequests/queries', () => ({
  useAdminExperiencePayments: () => ({ data: [] }),
  useAdminExperienceRequests: () => ({ data: requests, isLoading: false, isError: false }),
  useUpdateExperienceRequestStatus: () => ({ mutate: (...a: unknown[]) => mutate(...a), isPending: false }),
  useDeleteExperienceRequest: () => ({ mutate: vi.fn() }),
}))

describe('AdminExperienceRequests', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('shows each request with the guest, group, estimate and message', () => {
    render(<AdminExperienceRequests />)
    expect(screen.getByText('Amina Kamau')).toBeTruthy()
    expect(screen.getByText(/3 people/)).toBeTruthy()
    expect(screen.getByText(/15,000/)).toBeTruthy()
    expect(screen.getByText(/Vegetarian please/)).toBeTruthy()
  })

  it('confirms and declines a new request', () => {
    render(<AdminExperienceRequests />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(mutate).toHaveBeenCalledWith({ id: 'r1', status: 'confirmed' })
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(mutate).toHaveBeenCalledWith({ id: 'r1', status: 'declined' })
  })

  it('offers Mark completed on a confirmed request', () => {
    render(<AdminExperienceRequests />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }))
    expect(mutate).toHaveBeenCalledWith({ id: 'r2', status: 'completed' })
  })

  it('links WhatsApp only when the phone number is a valid Kenyan mobile', () => {
    render(<AdminExperienceRequests />)
    const links = screen.getAllByRole('link', { name: /WhatsApp guest/ })
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toContain('https://wa.me/254712345678')
  })
})
