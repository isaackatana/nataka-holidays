import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PaymentPanel } from '@/features/admin/payments/PaymentPanel'
import type { Payment } from '@/services/admin/payments.service'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

afterEach(cleanup)

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
    created_at: new Date().toISOString(),
    ...over,
  }
}

function renderPanel(payments: Payment[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PaymentPanel bookingId="b1" guestPhone="0712345678" estimatedTotal={20000} payments={payments} canRequest />
    </QueryClientProvider>,
  )
}

describe('PaymentPanel stuck prompts', () => {
  it('offers "Mark as failed" once a prompt has waited over five minutes', () => {
    renderPanel([payment({ created_at: new Date(Date.now() - 10 * 60_000).toISOString() })])
    expect(screen.getByRole('button', { name: 'Mark as failed' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Still waiting after 5 minutes')
  })

  it('does not offer it for a fresh prompt', () => {
    renderPanel([payment({})])
    expect(screen.queryByRole('button', { name: 'Mark as failed' })).toBeNull()
    expect(screen.getByText(/Waiting for the guest to enter their M-Pesa PIN/)).toBeTruthy()
  })

  it('does not offer it for finished payments', () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString()
    renderPanel([payment({ id: 'a', status: 'success', paid_amount: 5000, created_at: old })])
    expect(screen.queryByRole('button', { name: 'Mark as failed' })).toBeNull()
  })
})
