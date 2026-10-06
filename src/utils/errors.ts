/**
 * Turns whatever was thrown into a message a person can read.
 *
 * Supabase database errors are plain objects ({ message, code, ... }), NOT
 * Error instances, so `err instanceof Error` is false for them and the real
 * reason gets replaced by a generic fallback. This reads `.message` from
 * either kind.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err !== null) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

/** Postgres "unique violation" (e.g. two properties with the same slug). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505'
}
