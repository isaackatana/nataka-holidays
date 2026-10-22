import { supabase } from '@/lib/supabase'
import type { Experience } from '@/types/domain'

const BASE_COLUMNS = `
  id, title, slug, description, location, price, duration, video_url, is_published,
  created_at, updated_at,
  experience_images ( id, storage_path, sort_order )
`
const DETAIL_COLUMNS = `
  id, title, slug, description, location, price, duration, video_url, is_published,
  created_at, updated_at,
  price_type, category, included, meeting_point, min_age, what_to_bring, max_group_size, cancellation_policy,
  experience_images ( id, storage_path, sort_order )
`
const EXPERIENCE_SELECT = `
  id, title, slug, description, location, price, duration, video_url, is_published,
  created_at, updated_at,
  price_type, category, included, meeting_point, min_age, what_to_bring, max_group_size, cancellation_policy,
  deposit_percent,
  experience_images ( id, storage_path, sort_order )
`

/**
 * Newest first. Each step down is for a database that hasn't had a later
 * migration run yet (0027 deposit, then 0025 details), so the public pages keep
 * working with whatever columns exist instead of showing an error.
 */
const SELECT_TIERS = [
  { columns: EXPERIENCE_SELECT, hasCategory: true },
  { columns: DETAIL_COLUMNS, hasCategory: true },
  { columns: BASE_COLUMNS, hasCategory: false },
]

/** True when the database doesn't have the newer experience columns yet (migration 0025 not run). */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export interface ExperienceFilters {
  /** Free-text match against title and description. */
  search?: string
  location?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'title'
}

export async function getPublishedExperiences(
  filtersOrLimit?: ExperienceFilters | number,
  limit?: number,
): Promise<Experience[]> {
  // Accepts a bare number for backwards compatibility with the existing
  // `useExperiences(3)` call on the homepage, which just wants the N most
  // recent with no filtering.
  const filters: ExperienceFilters =
    typeof filtersOrLimit === 'number' ? {} : (filtersOrLimit ?? {})
  const effectiveLimit = typeof filtersOrLimit === 'number' ? filtersOrLimit : limit

  const build = (columns: string, withCategory: boolean) => {
    let query = supabase.from('experiences').select(columns).eq('is_published', true)

    if (filters.search) {
      // Matches either field — someone searching "dhow" shouldn't miss an
      // experience that only mentions it in the description.
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    if (filters.location) query = query.ilike('location', `%${filters.location}%`)
    if (withCategory && filters.category) query = query.eq('category', filters.category)
    if (filters.minPrice !== undefined) query = query.gte('price', filters.minPrice)
    if (filters.maxPrice !== undefined) query = query.lte('price', filters.maxPrice)

    switch (filters.sort) {
      case 'price_asc':
        // nullsFirst: false keeps price-on-request experiences (price is
        // nullable) at the end rather than sorting them as if they were
        // free, which would put them above every real price.
        query = query.order('price', { ascending: true, nullsFirst: false })
        break
      case 'price_desc':
        query = query.order('price', { ascending: false, nullsFirst: false })
        break
      case 'title':
        query = query.order('title', { ascending: true })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }

    if (effectiveLimit) query = query.limit(effectiveLimit)
    return query
  }

  let lastError: { code?: string } | null = null
  for (const tier of SELECT_TIERS) {
    const result = await build(tier.columns, tier.hasCategory)
    if (!result.error) return (result.data ?? []) as unknown as Experience[]
    if (!isMissingColumn(result.error)) throw result.error
    lastError = result.error
  }
  throw lastError
}

export async function getExperienceBySlug(slug: string): Promise<Experience | null> {
  const run = (columns: string) =>
    supabase.from('experiences').select(columns).eq('slug', slug).eq('is_published', true).single()

  let result = await run(SELECT_TIERS[0].columns)
  for (const tier of SELECT_TIERS.slice(1)) {
    if (!result.error || !isMissingColumn(result.error)) break
    result = await run(tier.columns)
  }

  if (result.error) {
    if (result.error.code === 'PGRST116') return null
    throw result.error
  }
  return result.data as unknown as Experience
}

/** Categories that at least one published experience uses (so the page only shows chips that lead somewhere). */
export async function getExperienceCategoriesInUse(): Promise<string[]> {
  const { data, error } = await supabase
    .from('experiences')
    .select('category')
    .eq('is_published', true)
    .not('category', 'is', null)
  if (error) {
    if (isMissingColumn(error)) return []
    throw error
  }
  const rows = (data ?? []) as unknown as { category: string | null }[]
  return [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))]
}
