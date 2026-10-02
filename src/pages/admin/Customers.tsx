import { useState } from 'react'
import { ShieldCheck, Shield } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useAdminCustomers, useUpdateCustomerRole } from '@/features/admin/customers/queries'
import { useDebounce } from '@/hooks/useDebounce'

export default function AdminCustomers() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const { data: customers, isLoading } = useAdminCustomers(debouncedSearch || undefined)
  const updateRole = useUpdateCustomerRole()

  function handleToggleAdmin(id: string, currentlyAdmin: boolean) {
    if (id === currentUser?.id && currentlyAdmin) {
      // Refuse in the UI, not just rely on the confirm dialog wording —
      // an admin removing their own access could lock the business out
      // of the dashboard entirely if they're the only admin account.
      window.alert(
        "You can't remove your own admin access from here. Ask another admin, or change it directly in Supabase.",
      )
      return
    }
    const verb = currentlyAdmin ? 'remove admin access from' : 'grant admin access to'
    if (!window.confirm(`Are you sure you want to ${verb} this user?`)) return
    updateRole.mutate({ id, role: currentlyAdmin ? 'customer' : 'admin' })
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-medium text-teal-900">Customers</h1>
      <p className="mt-1 text-sm text-charcoal-500">
        {customers?.length ?? 0} registered user{customers?.length === 1 ? '' : 's'}.
      </p>

      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full rounded-lg border border-sand-300 bg-sand-50 px-4 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-500 focus:border-teal-700 sm:w-72"
      />

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-10 animate-pulse rounded bg-sand-200" />
                  </td>
                </tr>
              ))}

            {!isLoading && customers?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-charcoal-500">
                  No users match that search.
                </td>
              </tr>
            )}

            {customers?.map((customer) => {
              const isAdmin = customer.role === 'admin'
              return (
                <tr key={customer.id} className="hover:bg-sand-100/60">
                  <td className="px-4 py-3 font-medium text-charcoal-900">
                    {customer.full_name ?? 'Unnamed'}
                    {customer.id === currentUser?.id && (
                      <span className="ml-2 text-xs font-normal text-charcoal-600">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">{customer.phone ?? '—'}</td>
                  <td className="px-4 py-3 font-figures text-charcoal-700">{customer.bookingCount}</td>
                  <td className="px-4 py-3 text-charcoal-500">
                    {new Date(customer.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
                        isAdmin ? 'bg-teal-900 text-sand-50' : 'bg-charcoal-500/10 text-charcoal-500'
                      }`}
                    >
                      {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                      {customer.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleAdmin(customer.id, isAdmin)}
                      className="rounded-lg border border-sand-300 px-3 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-sand-100"
                    >
                      {isAdmin ? 'Remove admin' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
