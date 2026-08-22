import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { MessageCircle, Heart, CalendarCheck, User, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useBusinessSettings } from '@/features/settings/queries'
import { buildWhatsAppLink } from '@/utils/whatsapp'
import { useDialogA11y } from '@/hooks/useDialogA11y'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Holiday Homes', to: '/holiday-homes' },
  { label: 'Experiences', to: '/experiences' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

/**
 * Shared shell for every public-facing route: sticky nav, footer, and the
 * persistent WhatsApp contact button. Real nav/footer content and the
 * WhatsApp deep-link builder land alongside the Home page build (Step 8).
 */
export function PublicLayout() {
  const { user, profile, signOut } = useAuth()
  const { data: settings } = useBusinessSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useDialogA11y<HTMLElement>(mobileMenuOpen, () => setMobileMenuOpen(false))

  // Close the mobile menu automatically on navigation — otherwise it'd
  // stay open over the new page after tapping a link inside it.
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <header className="sticky top-0 z-40 border-b border-sand-200 bg-sand-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center">
            <img
              src="/logo.svg"
              alt="Nataka Holidays"
              className="h-10 w-auto"
            />
          </Link>
          <nav className="hidden gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-charcoal-700 transition-colors hover:text-teal-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {user ? (
            <div className="hidden items-center gap-4 md:flex">
              <Link
                to="/favorites"
                aria-label="Favorites"
                className="text-charcoal-700 transition-colors hover:text-teal-800"
              >
                <Heart className="h-5 w-5" />
              </Link>
              <Link
                to="/my-bookings"
                aria-label="My bookings"
                className="text-charcoal-700 transition-colors hover:text-teal-800"
              >
                <CalendarCheck className="h-5 w-5" />
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 text-sm font-medium text-charcoal-700 transition-colors hover:text-teal-800"
              >
                <User className="h-5 w-5" />
                {profile?.full_name?.split(' ')[0] ?? 'Account'}
              </Link>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="text-charcoal-500 transition-colors hover:text-coral-500"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-full border border-teal-900 px-5 py-2 text-sm font-medium text-teal-900 transition-colors hover:bg-teal-900 hover:text-sand-50 md:inline-block"
            >
              Sign in
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="text-charcoal-700 md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Mobile menu — overlay + slide-over panel, same pattern as
          FilterPanel's mobile drawer for visual/interaction consistency
          across the app. md:hidden throughout since desktop uses the
          inline header nav/account cluster above instead. */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-charcoal-900/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        ref={mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed inset-y-0 right-0 z-[60] w-72 overflow-y-auto bg-sand-50 p-6 shadow-card-hover transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-medium text-teal-900">Menu</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="text-charcoal-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal-700 transition-colors hover:bg-sand-100 hover:text-teal-800"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-1 border-t border-sand-200 pt-4">
          {user ? (
            <>
              <Link
                to="/favorites"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal-700 hover:bg-sand-100 hover:text-teal-800"
              >
                <Heart className="h-4 w-4" />
                Favorites
              </Link>
              <Link
                to="/my-bookings"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal-700 hover:bg-sand-100 hover:text-teal-800"
              >
                <CalendarCheck className="h-4 w-4" />
                My bookings
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal-700 hover:bg-sand-100 hover:text-teal-800"
              >
                <User className="h-4 w-4" />
                {profile?.full_name?.split(' ')[0] ?? 'Account'}
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-coral-500 hover:bg-coral-500/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-teal-900 px-4 py-2.5 text-center text-sm font-medium text-sand-50 hover:bg-teal-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-sand-200 bg-teal-950 py-12 text-sand-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-lg">{settings?.business_name ?? 'Nataka Holidays'}</p>
            <p className="mt-2 max-w-md text-sm text-sand-300">
              {settings?.about_blurb ??
                'Villas, apartments and beach houses along Diani Beach and the Kenyan Coast.'}
            </p>
          </div>
          {(settings?.contact_phone || settings?.contact_email || settings?.address) && (
            <div className="flex flex-col gap-1 text-sm text-sand-300">
              {settings.contact_phone && <span>{settings.contact_phone}</span>}
              {settings.contact_email && <span>{settings.contact_email}</span>}
              {settings.address && <span>{settings.address}</span>}
            </div>
          )}
        </div>
      </footer>

      <a
        href={buildWhatsAppLink('Hello Nataka Holidays, I have a question.')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-pill bg-teal-700 text-sand-50 shadow-card transition-transform hover:scale-105 hover:shadow-card-hover"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  )
}
