import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthContext'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { InputField } from '@/components/ui/InputField'
import { Button } from '@/components/ui/Button'
import { CAPTCHA_PROMPT, useTurnstile } from '@/features/auth/Turnstile'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const captcha = useTurnstile()

  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo ?? '/'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    if (captcha.required && !captcha.token) {
      setFormError(CAPTCHA_PROMPT)
      return
    }
    try {
      await signIn(values.email, values.password, captcha.token ?? undefined)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
      captcha.reset() // a CAPTCHA token only works once
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-teal-900">Welcome back</h1>
        <p className="mt-1 text-sm text-charcoal-500">Sign in to manage your bookings and favorites.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {captcha.widget}

        {formError && <p className="text-sm text-coral-500">{formError}</p>}

        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-sm text-teal-800 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-charcoal-500">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-teal-800 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  )
}
