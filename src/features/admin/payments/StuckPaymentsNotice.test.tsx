import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { StuckPaymentsNotice } from '@/features/admin/payments/StuckPaymentsNotice'
import { getPayments, type Payment } from '@/services/admin/payments.service'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/services/admin/payments.service', () => ({ getPayments: vi.fn() }))

afterEach(cleanup)

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
function payment(over: Partial<Payment>): Payment {
  return {
    id: 'p1',
    booking_id: 'b1',
    amount: 5000,
    phone: '254712345678',
    method: 'mpesa',
    note: null,
    status: 'pending',
    mpesa_receipt: null,
    result_desc: null,
    paid_amount: null,
    created_at: minutesAgo(10),
    ...over,
  }
}

function renderNotice(payments: Payment[]) {
  vi.mocked(getPayments).mockResolvedValue(payments)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <StuckPaymentsNotice />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('StuckPaymentsNotice', () => {
  it('warns about a prompt stuck for over five minutes and links to Bookings', async () => {
    renderNotice([payment({})])
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('1 M-Pesa payment needs your attention')
    expect(screen.getByRole('link').getAttribute('href')).toBe('/admin/bookings')
  })

  it('counts several stuck payments', async () => {
    renderNotice([payment({ id: 'a' }), payment({ id: 'b' })])
    expect((await screen.findByRole('alert')).textContent).toContain('2 M-Pesa payments need your attention')
  })

  it('shows nothing when nothing is stuck', async () => {
    renderNotice([payment({ created_at: minutesAgo(1) }), payment({ id: 'c', status: 'success', paid_amount: 5000 })])
    await vi.waitFor(() => expect(getPayments).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
