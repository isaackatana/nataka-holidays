import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const signIn = vi.fn().mockResolvedValue(undefined)
const reset = vi.fn()
let captcha: { required: boolean; token: string | null }

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ signIn: (...a: unknown[]) => signIn(...a) }),
}))
vi.mock('@/features/auth/Turnstile', () => ({
  CAPTCHA_PROMPT: 'Please complete the security check.',
  useTurnstile: () => ({ ...captcha, widget: captcha.required ? <div data-testid="widget" /> : null, reset }),
}))

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('Login with CAPTCHA', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('signs in without any check when CAPTCHA is not switched on', async () => {
    captcha = { required: false, token: null }
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.queryByTestId('widget')).toBeNull()
    fillAndSubmit()
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('a@x.com', 'password123', undefined))
  })

  it('blocks sign-in until the check is completed', async () => {
    captcha = { required: true, token: null }
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.getByTestId('widget')).toBeTruthy()
    fillAndSubmit()
    await waitFor(() => expect(screen.getByText('Please complete the security check.')).toBeTruthy())
    expect(signIn).not.toHaveBeenCalled()
  })

  it('sends the token, and resets the check when sign-in fails', async () => {
    captcha = { required: true, token: 'tok123' }
    signIn.mockRejectedValueOnce(new Error('Invalid login credentials'))
    render(<MemoryRouter><Login /></MemoryRouter>)
    fillAndSubmit()
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('a@x.com', 'password123', 'tok123'))
    await waitFor(() => expect(reset).toHaveBeenCalled())
  })
})
