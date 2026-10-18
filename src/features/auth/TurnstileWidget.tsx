import { useEffect, useRef, type MutableRefObject } from 'react'
import { TURNSTILE_SITE_KEY } from '@/features/auth/turnstileConfig'

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptPromise = null // allow a retry on the next visit
        reject(new Error('Could not load the security check.'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

interface WidgetProps {
  onToken: (token: string | null) => void
  idRef: MutableRefObject<string | null>
  onLoadError: () => void
}

export function TurnstileWidget({ onToken, idRef, onLoadError }: WidgetProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile || !TURNSTILE_SITE_KEY) return
        idRef.current = window.turnstile.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => {
        if (!cancelled) onLoadError()
      })
    return () => {
      cancelled = true
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current)
      idRef.current = null
    }
  }, [idRef, onToken, onLoadError])

  return <div ref={container} data-testid="turnstile-widget" className="min-h-[65px]" />
}
