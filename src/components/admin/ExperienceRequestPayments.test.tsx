import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ExperienceRequestPayments } from './ExperienceRequestPayments'
import type { AdminExperienceRequest } from '@/services/admin/experienceRequests.service'
import type { ExperiencePayment } from '@/services/experiencePayments.service'

const recordPayment = vi.fn().mockResolvedValue(undefined)
const saveTotal = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/admin/experienceRequests/queries', () => ({
  useRecordExperiencePayment: () => ({ mutateAsync: (...a: unknown[]) => recordPayment(...a), isPending: false }),
  useSetAgreedTotal: () => ({ mutateAsync: (...a: unknown[]) => saveTotal(...a), isPending: false }),
}))

const request = {
  id: 'r1', experience_title: 'Dhow Trip', status: 'confirmed', estimated_total: 10000, agreed_total: null, deposit_percent: 30,
} as unknown as AdminExperienceRequest

const payment = (over: Partial<ExperiencePayment>): ExperiencePayment => ({
  id: 'p1', request_id: 'r1', amount: 3000, method: 'mpesa', note: null, status: 'success',
  mpesa_receipt: 'QWE123', paid_amount: 3000, created_at: '2026-12-01T10:00:00Z', ...over,
})

describe('ExperienceRequestPayments', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('shows total, paid and balance, counting only successful payments', () => {
    render(
      <ExperienceRequestPayments
        request={request}
        payments={[payment({}), payment({ id: 'p2', status: 'failed', amount: 5000, paid_amount: null, mpesa_receipt: null })]}
      />,
    )
    expect(screen.getByText(/Estimated total/)).toBeTruthy()
    expect(screen.getByText(/balance\D+7,000/)).toBeTruthy()
    expect(screen.getByText('QWE123')).toBeTruthy()
  })

  it('warns to refund when money was received on a cancelled request', () => {
    render(<ExperienceRequestPayments request={{ ...request, status: 'cancelled' }} payments={[payment({})]} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Refund it via M-Pesa/)
  })

  it('records a cash payment', async () => {
    render(<ExperienceRequestPayments request={request} payments={[]} />)
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Payment note'), { target: { value: 'paid at the jetty' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    await waitFor(() =>
      expect(recordPayment).toHaveBeenCalledWith({ requestId: 'r1', amount: 2500, method: 'cash', note: 'paid at the jetty' }),
    )
  })

  it('does not record an empty amount', async () => {
    render(<ExperienceRequestPayments request={request} payments={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/at least 1/))
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('saves an agreed total, and clears it when emptied', async () => {
    render(<ExperienceRequestPayments request={request} payments={[]} />)
    fireEvent.change(screen.getByLabelText(/Agreed total/), { target: { value: '9000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save total' }))
    await waitFor(() => expect(saveTotal).toHaveBeenCalledWith({ requestId: 'r1', total: 9000 }))
    fireEvent.change(screen.getByLabelText(/Agreed total/), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save total' }))
    await waitFor(() => expect(saveTotal).toHaveBeenLastCalledWith({ requestId: 'r1', total: null }))
  })
})
