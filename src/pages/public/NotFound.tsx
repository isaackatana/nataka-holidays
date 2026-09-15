import { Link } from 'react-router-dom'
import { SEO } from '@/components/shared/SEO'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6">
      <SEO
        title="Page Not Found"
        description="The page you're looking for doesn't exist, or may have moved."
        noindex
      />

      <span className="font-mono text-sm text-gold-600">404</span>
      <h1 className="font-display text-4xl font-medium text-teal-900">
        This page has drifted out to sea.
      </h1>
      <p className="text-charcoal-500">
        The page you're looking for doesn't exist, or may have moved.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 transition-colors hover:bg-teal-800"
      >
        Back to home
      </Link>
    </div>
  )
}
