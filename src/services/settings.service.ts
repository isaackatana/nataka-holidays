import { supabase } from '@/lib/supabase'

export interface BusinessSettings {
  business_name: string
  contact_phone: string | null
  contact_email: string | null
  address: string | null
  about_blurb: string | null
  instagram_url: string | null
  facebook_url: string | null
  hero_video_url: string | null
  hero_image_url: string | null
  updated_at: string
}

export type BusinessSettingsInput = Omit<BusinessSettings, 'updated_at'>

/** The row's primary key is a fixed boolean (`true`) — see
 * supabase/migrations/0005_business_settings.sql — so this always
 * fetches the same single row. Public read, per that migration's RLS. */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase.from('business_settings').select('*').eq('id', true).single()
  if (error) throw error
  return data as unknown as BusinessSettings
}

export async function updateBusinessSettings(input: BusinessSettingsInput): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .update(input as never)
    .eq('id', true)
    .select('*')
    .single()

  if (error) throw error
  return data as unknown as BusinessSettings
}
