import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  LayoutDashboard,
  Home,
  CalendarCheck,
  Users,
  Star,
  Compass,
  Settings,
  LogOut,
  Mail,
  Menu,
  X,
  ListChecks,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useAdminContactMessages } from '@/features/admin/contactMessages/queries'
import { useDialogA11y } from '@/hooks/useDialogA11y'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Properties', to: '/admin/properties', icon: Home },
  { label: 'Amenities', to: '/admin/amenities', icon: ListChecks },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarCheck },
  { label: 'Messages', to: '/admin/messages', icon: Mail },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Reviews', to: '/admin/reviews', icon: Star },
  { label: 'Experiences', to: '/admin/experiences', icon: Compass },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]

/**
 * Admin shell. Route guarding (RequireAdmin, redirecting non-admins) is
 * wired in Step 7 alongside authentication — this component is the visual
 * frame only.
 */
export function AdminLayout() {
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: unreadMessages } = useAdminContactMessages({ unreadOnly: true })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mobileNavRef = useDialogA11y<HTMLElement>(mobileNavOpen, () => setMobileNavOpen(false))

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  // Shared between the always-visible desktop sidebar and the mobile
  // slide-over drawer, so the two can't drift out of sync with each other.
  function renderNavItems() {
    return NAV_ITEMS.map(({ label, to, icon: Icon }) => {
      const isActive = location.pathname === to
      return (
        <Link
          key={to}
          to={to}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-teal-800 text-sand-50'
              : 'text-sand-300 hover:bg-teal-900 hover:text-sand-50'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
          {to === '/admin/messages' && (unreadMessages?.length ?? 0) > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-pill bg-gold-600 px-1.5 font-mono text-[10px] text-sand-50">
              {unreadMessages!.length}
            </span>
          )}
        </Link>
      )
    })
  }

  return (
    <div className="flex min-h-screen bg-sand-100">
      {/* Applies to every /admin/* route through this one shared layout,
          rather than repeating a noindex <SEO> tag on ten separate admin
          pages — the whole section is behind auth and has no reason to
          appear in search results. */}
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Desktop sidebar — persistent, hidden below md */}
      <aside className="hidden w-64 flex-col border-r border-sand-200 bg-teal-950 text-sand-100 md:flex">
        <div className="px-6 py-6">
          <span className="font-display text-lg">Nataka Holidays</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">{renderNavItems()}</nav>
      </aside>

      {/* Mobile nav — overlay + slide-over drawer, same interaction
          pattern as PublicLayout's mobile menu and FilterPanel's mobile
          drawer, for consistency across the app. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-charcoal-900/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        ref={mobileNavRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-teal-950 text-sand-100 transition-transform duration-300 md:hidden ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <span className="font-display text-lg">Nataka Holidays</span>
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="text-sand-300 hover:text-sand-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">{renderNavItems()}</nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-sand-200 bg-sand-50 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="text-charcoal-700 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-charcoal-500">
              Admin
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-charcoal-700 sm:gap-4">
            <span className="hidden sm:inline">{profile?.full_name ?? 'Admin'}</span>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="flex items-center gap-1.5 text-charcoal-500 transition-colors hover:text-coral-500"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
