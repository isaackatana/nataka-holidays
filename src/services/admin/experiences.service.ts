import { supabase } from '@/lib/supabase'
import type { Experience } from '@/types/domain'

const EXPERIENCE_SELECT = `
  id, title, slug, description, location, price, duration, video_url, is_published,
  created_at, updated_at,
  experience_images ( id, storage_path, sort_order )
`

export async function getAllExperiencesForAdmin(): Promise<Experience[]> {
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Experience[]
}

export async function getExperienceByIdForAdmin(id: string): Promise<Experience | null> {
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as Experience
}

export interface ExperienceInput {
  title: string
  slug: string
  description: string
  location: string | null
  price: number | null
  duration: string | null
  video_url: string | null
  is_published: boolean
}

export async function createExperience(input: ExperienceInput): Promise<Experience> {
  const { data, error } = await supabase
    .from('experiences')
    .insert(input as never)
    .select(EXPERIENCE_SELECT)
    .single()

  if (error) throw error
  return data as unknown as Experience
}

export async function updateExperience(id: string, input: ExperienceInput): Promise<Experience> {
  const { data, error } = await supabase
    .from('experiences')
    .update(input as never)
    .eq('id', id)
    .select(EXPERIENCE_SELECT)
    .single()

  if (error) throw error
  return data as unknown as Experience
}

export async function deleteExperience(id: string): Promise<void> {
  // Image rows cascade, but the files in storage don't: read the paths first
  // and remove the files once the experience is gone.
  const { data: images } = await supabase
    .from('experience_images')
    .select('storage_path')
    .eq('experience_id', id)
  const paths = ((images ?? []) as { storage_path: string }[]).map((i) => i.storage_path)

  const { error } = await supabase.from('experiences').delete().eq('id', id)
  if (error) throw error

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('experience-images').remove(paths)
    if (storageError) console.error('[deleteExperience] could not remove photo files:', storageError)
  }
}

export async function toggleExperiencePublished(id: string, isPublished: boolean): Promise<void> {
  const { error } = await supabase
    .from('experiences')
    .update({ is_published: isPublished } as never)
    .eq('id', id)
  if (error) throw error
}
