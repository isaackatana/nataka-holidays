/**
 * Cloudflare Turnstile (the free CAPTCHA). It is OFF unless VITE_TURNSTILE_SITE_KEY
 * is set, so the site works exactly as before until you turn it on.
 */
export const TURNSTILE_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)
