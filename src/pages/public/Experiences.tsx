import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { SEO } from '@/components/shared/SEO'
import { ExperienceCard } from '@/components/property/ExperienceCard'
import { useFilteredExperiences } from '@/features/experiences/queries'
import { useDebounce } from '@/hooks/useDebounce'
import { DESTINATIONS, DESTINATION_REGIONS } from '@/data/destinations'
import type { ExperienceFilters } from '@/services/experiences.service'

const SORT_OPTIONS: { value: NonNullable<ExperienceFilters['sort']>; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'title', label: 'Name (A–Z)' },
]

/** Filters live in the URL, same as the Holiday Homes page — so a
 * filtered view can be shared, bookmarked, and survives a back/forward
 * navigation. */
function parseFilters(params: URLSearchParams): ExperienceFilters {
  return {
    search: params.get('search') ?? undefined,
    location: params.get('location') ?? undefined,
    minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
    maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    sort: (params.get('sort') as ExperienceFilters['sort']) ?? 'newest',
  }
}

function filtersToParams(filters: ExperienceFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.location) params.set('location', filters.location)
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort)
  return params
}

export default function Experiences() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  // Only the free-text search needs debouncing — every other control
  // (selects, number inputs) changes infrequently by nature.
  const debouncedSearch = useDebounce(filters.search, 400)
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  )

  const { data: experiences, isLoading, isError } = useFilteredExperiences(effectiveFilters)

  function update(next: ExperienceFilters) {
    setSearchParams(filtersToParams(next), { replace: true })
  }

  const activeFilterCount = [
    filters.search,
    filters.location,
    filters.minPrice,
    filters.maxPrice,
  ].filter((v) => v !== undefined && v !== '').length

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <SEO
        title="Experiences on the Kenyan Coast"
        description="Dolphin tours, snorkeling, dhow sailing, safaris and airport transfers along the Kenyan Coast — from Diani and Wasini to Watamu, Malindi and Lamu."
        path="/experiences"
      />

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-teal-900 md:text-4xl">
            Experiences
          </h1>
          <p className="mt-2 max-w-2xl text-charcoal-500">
            Local trips and activities we can arrange alongside your stay, the length of the
            coast — dhow sailing off Lamu, diving in Watamu, dolphin trips from Wasini.
          </p>
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-teal-900 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-gold-600 px-1 font-mono text-[10px] text-sand-50">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Always-visible search + sort; the rest collapses behind the
          Filters toggle so the page stays uncluttered by default. */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          placeholder="Search experiences — dhow, diving, safari..."
          value={filters.search ?? ''}
          onChange={(e) => update({ ...filters, search: e.target.value || undefined })}
          className="flex-1 rounded-lg border border-sand-200 bg-sand-50 px-4 py-2.5 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700"
        />
        <select
          value={filters.sort ?? 'newest'}
          onChange={(e) => update({ ...filters, sort: e.target.value as ExperienceFilters['sort'] })}
          aria-label="Sort experiences"
          className="rounded-lg border border-sand-200 bg-sand-50 px-4 py-2.5 text-sm text-charcoal-900 outline-none focus:border-teal-700"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {filtersOpen && (
        <div className="mt-4 rounded-card border border-sand-200 bg-sand-50 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="exp-location" className="text-sm font-medium text-charcoal-700">
                Location
              </label>
              <select
                id="exp-location"
                value={filters.location ?? ''}
                onChange={(e) => update({ ...filters, location: e.target.value || undefined })}
                className="rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-teal-700"
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
              <label htmlFor="exp-min-price" className="text-sm font-medium text-charcoal-700">
                Min price (KES)
              </label>
              <input
                id="exp-min-price"
                type="number"
                min={0}
                placeholder="Any"
                value={filters.minPrice ?? ''}
                onChange={(e) =>
                  update({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined })
                }
                className="rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="exp-max-price" className="text-sm font-medium text-charcoal-700">
                Max price (KES)
              </label>
              <input
                id="exp-max-price"
                type="number"
                min={0}
                placeholder="Any"
                value={filters.maxPrice ?? ''}
                onChange={(e) =>
                  update({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })
                }
                className="rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-300 focus:border-teal-700"
              />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => update({ sort: filters.sort })}
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-teal-800 hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {isError && (
        <p className="mt-8 rounded-card bg-coral-500/10 p-6 text-sm text-coral-500">
          Something went wrong loading experiences. Please try again.
        </p>
      )}

      {!isError && (
        <>
          {!isLoading && experiences && (
            <p className="mt-6 text-sm text-charcoal-500">
              {experiences.length} experience{experiences.length === 1 ? '' : 's'}
              {activeFilterCount > 0 ? ' match your filters' : ''}
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/2] animate-pulse rounded-card bg-sand-200" />
              ))}

            {!isLoading && experiences?.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-charcoal-500">
                  {activeFilterCount > 0
                    ? 'No experiences match those filters.'
                    : 'No experiences listed yet — check back soon.'}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => update({ sort: filters.sort })}
                    className="rounded-full bg-teal-900 px-6 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {experiences?.map((experience) => (
              <ExperienceCard key={experience.id} experience={experience} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
