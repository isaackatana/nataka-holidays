import { useCallback, useRef, useState } from 'react'
import { captchaEnabled } from '@/features/auth/turnstileConfig'
import { TurnstileWidget } from '@/features/auth/TurnstileWidget'

/**
 * For a form: `widget` goes inside it, `token` goes to Supabase, and `reset()`
 * must be called after every attempt (a token works only once).
 * `required` is false when CAPTCHA isn't switched on, so forms skip the check.
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const idRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    setToken(null)
    if (idRef.current && window.turnstile) window.turnstile.reset(idRef.current)
  }, [])
  const onLoadError = useCallback(() => setLoadFailed(true), [])

  const widget = captchaEnabled ? (
    <div className="flex flex-col gap-1">
      <TurnstileWidget onToken={setToken} idRef={idRef} onLoadError={onLoadError} />
      {loadFailed && (
        <p className="text-xs text-coral-500">
          The security check couldn't load. Check your connection and refresh the page.
        </p>
      )}
    </div>
  ) : null

  return { required: captchaEnabled, token, widget, reset }
}

export const CAPTCHA_PROMPT = 'Please complete the security check.'
