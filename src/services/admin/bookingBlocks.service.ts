import { supabase } from '@/lib/supabase'
import { todayISO } from '@/utils/dates'

export interface AdminBlock {
  id: string
  property_id: string
  start_date: string
  end_date: string
  reason: string | null
  /** Set when the block was created by confirming a booking. */
  booking_id: string | null
}

/** Current and upcoming blocks for one property (past ones are noise). */
export async function getBlocksForProperty(propertyId: string): Promise<AdminBlock[]> {
  const { data, error } = await supabase
    .from('booking_blocks')
    .select('id, property_id, start_date, end_date, reason, booking_id')
    .eq('property_id', propertyId)
    .gte('end_date', todayISO())
    .order('start_date')
  if (error) throw error
  return (data ?? []) as unknown as AdminBlock[]
}

export interface NewBlock {
  propertyId: string
  startDate: string
  endDate: string
  reason: string
}

export async function createBlock(input: NewBlock): Promise<void> {
  const { error } = await supabase.from('booking_blocks').insert({
    property_id: input.propertyId,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason.trim() || null,
  } as never)
  if (error) throw error
}

export async function deleteBlock(id: string): Promise<void> {
  const { error } = await supabase.from('booking_blocks').delete().eq('id', id)
  if (error) throw error
}
