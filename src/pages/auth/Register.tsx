import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthContext'
import { registerSchema, type RegisterValues } from '@/features/auth/schemas'
import { InputField } from '@/components/ui/InputField'
import { Button } from '@/components/ui/Button'
import { CAPTCHA_PROMPT, useTurnstile } from '@/features/auth/Turnstile'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const captcha = useTurnstile()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterValues) {
    setFormError(null)
    if (captcha.required && !captcha.token) {
      setFormError(CAPTCHA_PROMPT)
      return
    }
    try {
      await signUp(values.email, values.password, values.fullName, captcha.token ?? undefined)
      // Supabase's default project settings require email confirmation
      // before a session is issued, so don't assume the user is logged
      // in yet — show a "check your inbox" state instead of redirecting.
      setConfirmationSent(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create your account.')
      captcha.reset() // a CAPTCHA token only works once
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-medium text-teal-900">Check your inbox</h1>
        <p className="text-sm text-charcoal-500">
          We've sent a confirmation link to your email. Confirm it to finish creating your account,
          then sign in.
        </p>
        <Button variant="secondary" className="mt-2" onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-teal-900">Create your account</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          Save favorites and track your booking enquiries.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <InputField
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <InputField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <InputField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {captcha.widget}

        {formError && <p className="text-sm text-coral-500">{formError}</p>}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-charcoal-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-teal-800 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
