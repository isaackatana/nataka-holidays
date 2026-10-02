import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Star, Eye, EyeOff } from 'lucide-react'
import {
  useAdminProperties,
  useDeleteProperty,
  useTogglePublished,
  useToggleFeatured,
} from '@/features/admin/properties/queries'
import { getPrimaryPropertyImageUrl } from '@/utils/storage'
import { formatKES } from '@/utils/currency'

export default function AdminProperties() {
  const { data: properties, isLoading } = useAdminProperties()
  const deleteProperty = useDeleteProperty()
  const togglePublished = useTogglePublished()
  const toggleFeatured = useToggleFeatured()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This can't be undone. Existing booking enquiries for this property will be kept, just unlinked.`)) {
      return
    }
    setDeletingId(id)
    try {
      await deleteProperty.mutateAsync(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Properties</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            {properties?.length ?? 0} propert{properties?.length === 1 ? 'y' : 'ies'} total
          </p>
        </div>
        <Link
          to="/admin/properties/new"
          className="flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          New property
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Featured</th>
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

            {!isLoading && properties?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-charcoal-500">
                  No properties yet.{' '}
                  <Link to="/admin/properties/new" className="text-teal-800 underline">
                    Add your first one
                  </Link>
                  .
                </td>
              </tr>
            )}

            {properties?.map((property) => {
              const imageUrl = getPrimaryPropertyImageUrl(property.property_images)
              return (
                <tr key={property.id} className="hover:bg-sand-100/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-sand-200">
                        {imageUrl && (
                          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-charcoal-900">{property.title}</p>
                        <p className="font-mono text-xs text-charcoal-600">/{property.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">{property.location}</td>
                  <td className="px-4 py-3 font-figures text-charcoal-700">
                    {formatKES(property.price_per_night)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        togglePublished.mutate({ id: property.id, isPublished: !property.is_published })
                      }
                      className={`flex items-center gap-1.5 rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                        property.is_published
                          ? 'bg-teal-900 text-sand-50'
                          : 'bg-charcoal-500/10 text-charcoal-500'
                      }`}
                    >
                      {property.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {property.is_published ? 'Published' : 'Unpublished'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleFeatured.mutate({ id: property.id, isFeatured: !property.is_featured })}
                      aria-label={property.is_featured ? 'Unfeature' : 'Feature'}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          property.is_featured ? 'fill-gold-500 text-gold-500' : 'text-sand-300'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/properties/${property.id}/edit`}
                        aria-label="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-sand-300 text-charcoal-700 hover:bg-sand-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(property.id, property.title)}
                        disabled={deletingId === property.id}
                        aria-label="Delete"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-sand-300 text-coral-500 hover:bg-coral-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
