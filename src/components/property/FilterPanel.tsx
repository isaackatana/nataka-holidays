import { SlidersHorizontal, X } from 'lucide-react'
import { useAmenities } from '@/features/properties/queries'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { DESTINATIONS, DESTINATION_REGIONS } from '@/data/destinations'
import type { PropertyFilters } from '@/services/properties.service'

const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: 'villa', label: 'Villa' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'beach_house', label: 'Beach House' },
  { value: 'other', label: 'Other' },
]

const SORT_OPTIONS: { value: NonNullable<PropertyFilters['sort']>; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
]

interface FilterPanelProps {
  filters: PropertyFilters
  onChange: (filters: PropertyFilters) => void
  resultCount?: number
  isOpen: boolean
  onClose: () => void
}

export function FilterPanel({ filters, onChange, resultCount, isOpen, onClose }: FilterPanelProps) {
  const { data: amenities } = useAmenities()
  // isOpen only ever becomes true via the mobile-only "Filters" trigger
  // button (md:hidden in HolidayHomes.tsx) — on desktop this panel is an
  // always-visible sticky sidebar, not a modal, so role="dialog" isn't
  // applied here the way it is on PublicLayout/AdminLayout's mobile
  // menus. Escape-to-close and focus management are still correct
  // regardless, since in practice isOpen only reflects the mobile case.
  const panelRef = useDialogA11y<HTMLElement>(isOpen, onClose)

  function update<K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function toggleAmenity(id: string) {
    const current = filters.amenityIds ?? []
    const next = current.includes(id) ? current.filter((a) => a !== id) : [...current, id]
    update('amenityIds', next.length > 0 ? next : undefined)
  }

  function clearAll() {
    onChange({ sort: filters.sort })
  }

  const activeFilterCount = [
    filters.location,
    filters.propertyType,
    filters.minPrice,
    filters.maxPrice,
    filters.minGuests,
    filters.minBedrooms,
    filters.amenityIds?.length,
  ].filter(Boolean).length

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-900/40 md:hidden" onClick={onClose} />
      )}

      <aside
        ref={panelRef}
        className={`fixed inset-y-0 right-0 z-50 w-80 overflow-y-auto bg-sand-50 p-6 transition-transform md:sticky md:top-24 md:z-0 md:h-fit md:w-full md:translate-x-0 md:rounded-card md:p-5 md:shadow-card ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-medium text-teal-900">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </h2>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="text-xs font-medium text-teal-800 hover:underline">
                Clear all
              </button>
            )}
            <button onClick={onClose} aria-label="Close filters" className="text-charcoal-500 md:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {resultCount !== undefined && (
          <p className="mt-1 text-xs text-charcoal-500">{resultCount} propert{resultCount === 1 ? 'y' : 'ies'}</p>
        )}

        <div className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Sort by</label>
            <select
              value={filters.sort ?? 'featured'}
              onChange={(e) => update('sort', e.target.value as PropertyFilters['sort'])}
              className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-location" className="text-sm font-medium text-charcoal-700">
              Location
            </label>
            <select
              id="filter-location"
              value={filters.location ?? ''}
              onChange={(e) => update('location', e.target.value || undefined)}
              className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
            >
              <option value="">Anywhere on the coast</option>
              {DESTINATION_REGIONS.map((region) => (
                <optgroup key={region} label={region}>
                  {DESTINATIONS.filter((d) => d.region === region).map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Property type</label>
            <select
              value={filters.propertyType ?? ''}
              onChange={(e) => update('propertyType', e.target.value || undefined)}
              className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
            >
              <option value="">Any type</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Price per night (KES)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.minPrice ?? ''}
                onChange={(e) => update('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700"
              />
              <span className="text-charcoal-400">–</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.maxPrice ?? ''}
                onChange={(e) => update('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Guests</label>
            <input
              type="number"
              min={1}
              placeholder="Any"
              value={filters.minGuests ?? ''}
              onChange={(e) => update('minGuests', e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Bedrooms (min)</label>
            <input
              type="number"
              min={1}
              placeholder="Any"
              value={filters.minBedrooms ?? ''}
              onChange={(e) => update('minBedrooms', e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700"
            />
          </div>

          {amenities && amenities.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-charcoal-700">Amenities</label>
              <div className="flex flex-col gap-2">
                {amenities.map((amenity) => (
                  <label key={amenity.id} className="flex items-center gap-2 text-sm text-charcoal-700">
                    <input
                      type="checkbox"
                      checked={filters.amenityIds?.includes(amenity.id) ?? false}
                      onChange={() => toggleAmenity(amenity.id)}
                      className="h-4 w-4 rounded border-sand-300 text-teal-700 focus:ring-teal-700"
                    />
                    {amenity.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
