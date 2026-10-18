import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthContext'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas'
import { InputField } from '@/components/ui/InputField'
import { Button } from '@/components/ui/Button'
import { CAPTCHA_PROMPT, useTurnstile } from '@/features/auth/Turnstile'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const captcha = useTurnstile()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null)
    if (captcha.required && !captcha.token) {
      setFormError(CAPTCHA_PROMPT)
      return
    }
    try {
      await requestPasswordReset(values.email, captcha.token ?? undefined)
      setSent(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to send reset link.')
      captcha.reset() // a CAPTCHA token only works once
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-medium text-teal-900">Check your inbox</h1>
        <p className="text-sm text-charcoal-500">
          If an account exists for that email, we've sent a link to reset your password.
        </p>
        <Link to="/login" className="mt-2 text-sm font-medium text-teal-800 hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-teal-900">Reset your password</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          Enter your email and we'll send you a link to reset it.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <InputField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        {captcha.widget}

        {formError && <p className="text-sm text-coral-500">{formError}</p>}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-charcoal-500">
        <Link to="/login" className="font-medium text-teal-800 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
