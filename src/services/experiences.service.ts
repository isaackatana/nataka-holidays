import { supabase } from '@/lib/supabase'
import type { Experience } from '@/types/domain'

const EXPERIENCE_SELECT = `
  id, title, slug, description, location, price, duration, video_url, is_published,
  created_at, updated_at,
  experience_images ( id, storage_path, sort_order )
`

export interface ExperienceFilters {
  /** Free-text match against title and description. */
  search?: string
  location?: string
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

  let query = supabase.from('experiences').select(EXPERIENCE_SELECT).eq('is_published', true)

  if (filters.search) {
    // Matches either field — someone searching "dhow" shouldn't miss an
    // experience that only mentions it in the description.
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }
  if (filters.location) query = query.ilike('location', `%${filters.location}%`)
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

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Experience[]
}

export async function getExperienceBySlug(slug: string): Promise<Experience | null> {
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as Experience
}
