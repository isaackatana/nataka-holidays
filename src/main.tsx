import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import './index.css'

const rootElement = document.getElementById('root')!

/**
 * App is imported dynamically and wrapped in try/catch rather than a
 * static top-level `import App from './App'`. This matters: some of
 * App's transitive imports (src/lib/supabase.ts) throw synchronously at
 * MODULE EVALUATION TIME if required env vars are missing — that happens
 * before React ever calls render(), so <ErrorBoundary> (which only
 * catches errors during render/lifecycle) cannot catch it. A static
 * import failing this way blanks the page with nothing but a console
 * error and no way for React to intervene.
 * Verified the underlying mechanism directly in Node: a module that
 * throws at the top level aborts a static `import` with no way to catch
 * it (process exits, nothing after the import line runs), while
 * `await import(...)` wrapped in try/catch does catch it. Same ES module
 * evaluation semantics apply in the browser.
 */
import('./App')
  .then(({ default: App }) => {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    console.error('Failed to load the application:', error)
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    // Plain DOM, not JSX/React — if we're here, we can't trust React's
    // own module graph loaded cleanly, so this avoids depending on it.
    // Colors are hardcoded (not Tailwind classes) for the same reason —
    // this must render even if the CSS/JS bundle is what failed. Keep
    // these in sync with src/index.css's sand-50/charcoal-900/
    // charcoal-500/teal-900 tokens by hand if the brand palette changes;
    // nothing enforces that automatically.
    rootElement.innerHTML = `
      <div style="display:flex;min-height:100vh;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;font-family:sans-serif;background:#f8f4ea;color:#263234;">
        <h1 style="font-size:24px;font-weight:500;margin:0;">Something went wrong</h1>
        <p style="max-width:420px;color:#687678;font-size:14px;margin:0;">${message}</p>
        <button onclick="window.location.reload()" style="margin-top:8px;border-radius:999px;background:#0f5c5e;color:#f8f4ea;padding:10px 24px;font-size:14px;border:none;cursor:pointer;">
          Refresh the page
        </button>
      </div>
    `
  })
