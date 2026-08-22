import { lazy, Suspense, type ReactNode, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
import { RouteLoadingFallback } from '@/components/shared/RouteLoadingFallback'

// Every page is lazy-loaded rather than statically imported. Before this,
// main.tsx's single `import('./App')` put the ENTIRE app — including the
// full admin CRUD system, image uploader, and every admin form — into one
// bundle that every visitor downloaded just to see the homepage (measured
// at ~375KB gzipped for this app). Splitting per-route means a customer
// browsing listings never fetches the admin bundle, and vice versa.
function lazyPage<T extends { default: ComponentType }>(loader: () => Promise<T>) {
  const Component = lazy(loader)
  return <Component />
}

function withSuspense(node: ReactNode): ReactNode {
  return <Suspense fallback={<RouteLoadingFallback />}>{node}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: withSuspense(lazyPage(() => import('@/pages/public/Home'))) },
      {
        path: '/holiday-homes',
        element: withSuspense(lazyPage(() => import('@/pages/public/HolidayHomes'))),
      },
      {
        path: '/stays/:slug',
        element: withSuspense(lazyPage(() => import('@/pages/public/PropertyDetails'))),
      },
      {
        path: '/experiences',
        element: withSuspense(lazyPage(() => import('@/pages/public/Experiences'))),
      },
      {
        path: '/experiences/:slug',
        element: withSuspense(lazyPage(() => import('@/pages/public/ExperienceDetails'))),
      },
      { path: '/about', element: withSuspense(lazyPage(() => import('@/pages/public/About'))) },
      { path: '/contact', element: withSuspense(lazyPage(() => import('@/pages/public/Contact'))) },
      {
        // Customer-only pages — redirect to /login (with a return path) if
        // there's no session at all. Role isn't checked here since any
        // authenticated user (customer or admin) may use these.
        element: <RequireAuth />,
        children: [
          {
            path: '/favorites',
            element: withSuspense(lazyPage(() => import('@/pages/account/Favorites'))),
          },
          {
            path: '/my-bookings',
            element: withSuspense(lazyPage(() => import('@/pages/account/MyBookings'))),
          },
          {
            path: '/profile',
            element: withSuspense(lazyPage(() => import('@/pages/account/Profile'))),
          },
        ],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: withSuspense(lazyPage(() => import('@/pages/auth/Login'))) },
      { path: '/register', element: withSuspense(lazyPage(() => import('@/pages/auth/Register'))) },
      {
        path: '/forgot-password',
        element: withSuspense(lazyPage(() => import('@/pages/auth/ForgotPassword'))),
      },
      {
        path: '/reset-password',
        element: withSuspense(lazyPage(() => import('@/pages/auth/ResetPassword'))),
      },
    ],
  },
  {
    path: '/admin',
    // Every /admin/* route requires role = 'admin' — RequireAdmin redirects
    // signed-out users to /login and signed-in non-admins to /.
    element: <RequireAdmin />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: withSuspense(lazyPage(() => import('@/pages/admin/Dashboard'))) },
          {
            path: 'properties',
            element: withSuspense(lazyPage(() => import('@/pages/admin/Properties'))),
          },
          {
            path: 'properties/new',
            element: withSuspense(lazyPage(() => import('@/pages/admin/PropertyEditor'))),
          },
          {
            path: 'properties/:id/edit',
            element: withSuspense(lazyPage(() => import('@/pages/admin/PropertyEditor'))),
          },
          {
            path: 'amenities',
            element: withSuspense(lazyPage(() => import('@/pages/admin/Amenities'))),
          },
          { path: 'bookings', element: withSuspense(lazyPage(() => import('@/pages/admin/Bookings'))) },
          { path: 'messages', element: withSuspense(lazyPage(() => import('@/pages/admin/Messages'))) },
          {
            path: 'customers',
            element: withSuspense(lazyPage(() => import('@/pages/admin/Customers'))),
          },
          { path: 'reviews', element: withSuspense(lazyPage(() => import('@/pages/admin/Reviews'))) },
          {
            path: 'experiences',
            element: withSuspense(lazyPage(() => import('@/pages/admin/Experiences'))),
          },
          {
            path: 'experiences/new',
            element: withSuspense(lazyPage(() => import('@/pages/admin/ExperienceEditor'))),
          },
          {
            path: 'experiences/:id/edit',
            element: withSuspense(lazyPage(() => import('@/pages/admin/ExperienceEditor'))),
          },
          { path: 'settings', element: withSuspense(lazyPage(() => import('@/pages/admin/Settings'))) },
        ],
      },
    ],
  },
  { path: '*', element: withSuspense(lazyPage(() => import('@/pages/public/NotFound'))) },
])
