import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, ExternalLink, Eye, EyeOff, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import {
  useAdminProperties,
  useDeleteProperty,
  useDuplicateProperty,
  useToggleFeatured,
  useTogglePublished,
} from '@/features/admin/properties/queries'
import { useDebounce } from '@/hooks/useDebounce'
import { formatKES } from '@/utils/currency'
import { errorMessage } from '@/utils/errors'
import { getPrimaryPropertyImageUrl } from '@/utils/storage'

type StatusFilter = 'all' | 'published' | 'unpublished'

const actionButton =
  'flex h-10 w-10 items-center justify-center rounded-lg border border-sand-300 text-charcoal-700 hover:bg-sand-100 disabled:opacity-50'

export default function AdminProperties() {
  const navigate = useNavigate()
  const { data: properties, isLoading, isError } = useAdminProperties()
  const deleteProperty = useDeleteProperty()
  const duplicateProperty = useDuplicateProperty()
  const togglePublished = useTogglePublished()
  const toggleFeatured = useToggleFeatured()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const debouncedSearch = useDebounce(search, 200)

  const visible = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return (properties ?? []).filter((p) => {
      if (status === 'published' && !p.is_published) return false
      if (status === 'unpublished' && p.is_published) return false
      if (!term) return true
      return `${p.title} ${p.location} ${p.slug}`.toLowerCase().includes(term)
    })
  }, [properties, debouncedSearch, status])

  const total = properties?.length ?? 0
  const filtering = debouncedSearch.trim() !== '' || status !== 'all'

  async function handleDelete(id: string, title: string) {
    if (
      !window.confirm(
        `Delete "${title}" permanently?\n\nThis also deletes its photos, reviews and guests' favourites, and can't be undone. Booking enquiries are kept.\n\nTo just hide it from the website, press Cancel and use the Published switch instead.`,
      )
    ) {
      return
    }
    setActionError(null)
    setDeletingId(id)
    try {
      await deleteProperty.mutateAsync(id)
    } catch (err) {
      setActionError(errorMessage(err, `Could not delete "${title}".`))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDuplicate(id: string) {
    setActionError(null)
    setDuplicatingId(id)
    try {
      const copy = await duplicateProperty.mutateAsync(id)
      navigate(`/admin/properties/${copy.id}/edit`)
    } catch (err) {
      setActionError(errorMessage(err, 'Could not duplicate that property.'))
    } finally {
      setDuplicatingId(null)
    }
  }

  function runToggle(action: () => Promise<unknown>, failure: string) {
    setActionError(null)
    action().catch((err) => setActionError(errorMessage(err, failure)))
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Properties</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            {filtering ? `${visible.length} of ${total}` : total} propert{total === 1 ? 'y' : 'ies'}
            {filtering ? ' shown' : ' total'}
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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500"
            aria-hidden
          />
          <label htmlFor="property-search" className="sr-only">
            Search properties
          </label>
          <input
            id="property-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, location or URL"
            className="w-full rounded-lg border border-sand-400 bg-sand-50 py-2.5 pl-9 pr-3 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-500 focus:border-teal-700"
          />
        </div>
        <label className="sr-only" htmlFor="property-status">
          Show
        </label>
        <select
          id="property-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-lg border border-sand-400 bg-sand-50 px-3 py-2.5 text-sm text-charcoal-900 outline-none focus:border-teal-700"
        >
          <option value="all">All properties</option>
          <option value="published">Published only</option>
          <option value="unpublished">Unpublished only</option>
        </select>
      </div>

      {(isError || actionError) && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-coral-500/10 px-4 py-3 text-sm text-coral-500"
        >
          {actionError ?? 'Could not load properties. Please refresh the page.'}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">All properties with their status and actions</caption>
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Property
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Location
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Price
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Featured
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
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

            {!isLoading && total === 0 && (
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

            {!isLoading && total > 0 && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-charcoal-500">
                  Nothing matches that search.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setStatus('all')
                    }}
                    className="text-teal-800 underline"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}

            {visible.map((property) => {
              const imageUrl = getPrimaryPropertyImageUrl(property.property_images)
              const noPhotos = !property.property_images || property.property_images.length === 0
              return (
                <tr key={property.id} className="hover:bg-sand-100/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-sand-200">
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-charcoal-900">{property.title}</p>
                        <p className="font-mono text-xs text-charcoal-600">/{property.slug}</p>
                        {property.is_published && noPhotos && (
                          <p className="mt-0.5 text-xs font-medium text-coral-500">
                            Published with no photos
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">{property.location}</td>
                  <td className="px-4 py-3 font-figures text-charcoal-700">
                    {formatKES(property.price_per_night)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        runToggle(
                          () =>
                            togglePublished.mutateAsync({
                              id: property.id,
                              isPublished: !property.is_published,
                            }),
                          `Could not ${property.is_published ? 'unpublish' : 'publish'} "${property.title}".`,
                        )
                      }
                      aria-pressed={property.is_published}
                      aria-label={`${property.title}: ${property.is_published ? 'published' : 'unpublished'}. Press to ${property.is_published ? 'unpublish' : 'publish'}.`}
                      className={`flex items-center gap-1.5 rounded-pill px-3 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                        property.is_published
                          ? 'bg-teal-900 text-sand-50'
                          : 'bg-charcoal-500/10 text-charcoal-500'
                      }`}
                    >
                      {property.is_published ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                      {property.is_published ? 'Published' : 'Unpublished'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        runToggle(
                          () =>
                            toggleFeatured.mutateAsync({
                              id: property.id,
                              isFeatured: !property.is_featured,
                            }),
                          `Could not update "${property.title}".`,
                        )
                      }
                      aria-pressed={property.is_featured}
                      aria-label={`${property.is_featured ? 'Unfeature' : 'Feature'} ${property.title}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sand-100"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          property.is_featured ? 'fill-gold-500 text-gold-500' : 'text-sand-400'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {property.is_published && (
                        <Link
                          to={`/stays/${property.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${property.title} on the website (opens in a new tab)`}
                          className={actionButton}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                      <Link
                        to={`/admin/properties/${property.id}/edit`}
                        aria-label={`Edit ${property.title}`}
                        className={actionButton}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(property.id)}
                        disabled={duplicatingId === property.id}
                        aria-label={`Duplicate ${property.title}`}
                        className={actionButton}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(property.id, property.title)}
                        disabled={deletingId === property.id}
                        aria-label={`Delete ${property.title}`}
                        className={`${actionButton} text-coral-500 hover:bg-coral-500/10`}
                      >
                        <Trash2 className="h-4 w-4" />
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
