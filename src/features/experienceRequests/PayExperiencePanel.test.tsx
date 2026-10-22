import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PayExperiencePanel } from './PayExperiencePanel'
import type { ExperienceAmountDue } from '@/services/experiencePayments.service'

const mutate = vi.fn()
let due: ExperienceAmountDue | undefined

vi.mock('@/features/experienceRequests/paymentQueries', () => ({
  useExperienceAmountDue: () => ({ data: due }),
  usePayForExperience: () => ({ mutate: (...a: unknown[]) => mutate(...a), isPending: false, isError: false, error: null }),
}))

const base = { requestId: 'r1', confirmed: true, defaultPhone: '0712345678', payments: [] }

describe('PayExperiencePanel', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('offers the deposit the database says is due, and sends only the phone number', () => {
    due = { payable: true, reason: null, phase: 'deposit', total: 10000, deposit: 3000, paid: 0, due_now: 3000 }
    render(<PayExperiencePanel {...base} />)
    fireEvent.click(screen.getByRole('button', { name: /Pay deposit/ }))
    expect(screen.getByRole('button', { name: /3,000/ })).toBeTruthy()
    expect(mutate).toHaveBeenCalledWith({ requestId: 'r1', phone: '0712345678' })
  })

  it('offers the balance once the deposit is paid', () => {
    due = { payable: true, reason: null, phase: 'balance', total: 10000, deposit: 3000, paid: 3000, due_now: 7000 }
    render(<PayExperiencePanel {...base} />)
    expect(screen.getByRole('button', { name: /Pay balance/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /7,000/ })).toBeTruthy()
  })

  it('says paid in full when nothing is left', () => {
    due = { payable: false, reason: 'paid', phase: 'paid', total: 10000, paid: 10000, due_now: 0 }
    render(<PayExperiencePanel {...base} />)
    expect(screen.getByText(/Paid in full/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not offer payment when online payment is not set up, and explains', () => {
    due = { payable: false, reason: 'not_offered', phase: 'balance', total: 10000, paid: 0, due_now: 10000 }
    render(<PayExperiencePanel {...base} />)
    expect(screen.getByText(/share payment details/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows nothing extra on a completed request that is not paid in full', () => {
    due = { payable: false, reason: 'not_confirmed', phase: 'balance', total: 10000, paid: 3000, due_now: 7000 }
    render(<PayExperiencePanel {...base} confirmed={false} />)
    expect(screen.getByText(/Paid\D+3,000 of\D+10,000/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('disables the button while a prompt is waiting for the PIN', () => {
    due = { payable: true, reason: null, phase: 'deposit', total: 10000, deposit: 3000, paid: 0, due_now: 3000 }
    render(
      <PayExperiencePanel
        {...base}
        payments={[{ id: 'p1', request_id: 'r1', amount: 3000, method: 'mpesa', note: null, status: 'pending', mpesa_receipt: null, paid_amount: null, created_at: 'x' }]}
      />,
    )
    expect((screen.getByRole('button', { name: /Pay deposit/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/enter your M-Pesa PIN…/)).toBeTruthy()
  })

  it('shows nothing for a request that is not found', () => {
    due = { payable: false, reason: 'not_found', phase: 'unavailable' }
    expect(render(<PayExperiencePanel {...base} />).container.textContent).toBe('')
  })
})
