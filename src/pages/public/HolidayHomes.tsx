import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { PropertyCard } from '@/components/property/PropertyCard'
import { PropertyCardSkeleton } from '@/components/property/PropertyCardSkeleton'
import { FilterPanel } from '@/components/property/FilterPanel'
import { useProperties } from '@/features/properties/queries'
import { useFavoriteActions } from '@/features/favorites/useFavoriteActions'
import { useDebounce } from '@/hooks/useDebounce'
import type { PropertyFilters } from '@/services/properties.service'

/** Reads the current URL search params into a typed PropertyFilters. */
function parseFiltersFromParams(params: URLSearchParams): PropertyFilters {
  const amenityIds = params.get('amenities')
  return {
    location: params.get('location') ?? undefined,
    propertyType: params.get('propertyType') ?? undefined,
    minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
    maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    minGuests: params.get('guests') ? Number(params.get('guests')) : undefined,
    minBedrooms: params.get('bedrooms') ? Number(params.get('bedrooms')) : undefined,
    checkIn: params.get('checkIn') ?? undefined,
    checkOut: params.get('checkOut') ?? undefined,
    amenityIds: amenityIds ? amenityIds.split(',') : undefined,
    sort: (params.get('sort') as PropertyFilters['sort']) ?? 'featured',
  }
}

function filtersToParams(filters: PropertyFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.location) params.set('location', filters.location)
  if (filters.propertyType) params.set('propertyType', filters.propertyType)
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
  if (filters.minGuests !== undefined) params.set('guests', String(filters.minGuests))
  if (filters.minBedrooms !== undefined) params.set('bedrooms', String(filters.minBedrooms))
  if (filters.checkIn) params.set('checkIn', filters.checkIn)
  if (filters.checkOut) params.set('checkOut', filters.checkOut)
  if (filters.amenityIds && filters.amenityIds.length > 0) params.set('amenities', filters.amenityIds.join(','))
  if (filters.sort && filters.sort !== 'featured') params.set('sort', filters.sort)
  return params
}

export default function HolidayHomes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams])
  // Only the free-text location field needs debouncing — every other
  // control (selects, checkboxes, number blur) already fires infrequently.
  const debouncedLocation = useDebounce(filters.location, 400)
  const effectiveFilters = useMemo(
    () => ({ ...filters, location: debouncedLocation }),
    [filters, debouncedLocation],
  )

  const { data: properties, isLoading, isError } = useProperties(effectiveFilters)
  const { isFavorited, handleToggle } = useFavoriteActions()

  function handleFilterChange(next: PropertyFilters) {
    setSearchParams(filtersToParams(next), { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <SEO
        title="Holiday Homes on the Kenyan Coast"
        description="Browse villas, apartments, cottages and beach houses along the Kenyan Coast — Diani, Mombasa, Kilifi, Watamu, Malindi and Lamu. Filter by price, bedrooms, guests and amenities."
        path="/holiday-homes"
      />

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">
            Holiday homes on the Kenyan Coast
          </h1>
          <p className="mt-2 text-charcoal-500">
            {filters.checkIn && filters.checkOut
              ? `Showing homes available ${filters.checkIn} to ${filters.checkOut}`
              : 'Villas, apartments, cottages and beach houses, ready to book.'}
          </p>
        </div>
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-teal-900 px-4 py-2 text-sm font-medium text-teal-900 md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[280px_1fr]">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          resultCount={properties?.length}
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
        />

        <div>
          {isError && (
            <p className="rounded-card bg-coral-500/10 p-6 text-sm text-coral-500">
              Something went wrong loading properties. Please try again.
            </p>
          )}

          {!isError && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {isLoading && Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)}

              {!isLoading && properties?.length === 0 && (
                <p className="col-span-full py-16 text-center text-charcoal-500">
                  No properties match those filters. Try widening your search.
                </p>
              )}

              {properties?.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  isFavorited={isFavorited(property.id)}
                  onToggleFavorite={handleToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
