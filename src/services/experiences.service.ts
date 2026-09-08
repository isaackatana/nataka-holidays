import { supabase } from '@/lib/supabase'
import type { Experience } from '@/types/domain'

const EXPERIENCE_SELECT = `
  id, title, slug, description, location, price, duration, video_url, is_published,
  created_at, updated_at,
  experience_images ( id, storage_path, sort_order )
`

export async function getPublishedExperiences(limit?: number): Promise<Experience[]> {
  let query = supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (limit) query = query.limit(limit)

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
