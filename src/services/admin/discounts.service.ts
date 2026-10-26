import { supabase } from '@/lib/supabase'
import type { DiscountCode } from '@/types/domain'

export interface DiscountInput {
  code: string
  kind: 'percent' | 'amount'
  value: number
  min_subtotal: number
  max_uses: number | null
  once_per_guest: boolean
  expires_at: string | null
}

export async function getDiscountCodes(): Promise<DiscountCode[]> {
  const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as DiscountCode[]
}

export async function createDiscountCode(input: DiscountInput): Promise<void> {
  const { error } = await supabase.from('discount_codes').insert({ ...input, code: input.code.trim().toUpperCase() } as never)
  if (error) {
    if (error.code === '23505') throw new Error('You already have a code with that name.')
    throw new Error(error.message)
  }
}

export async function setDiscountCodeActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('discount_codes').update({ is_active: isActive } as never).eq('id', id)
  if (error) throw error
}

/** Orders that used the code keep their discount; only the code itself goes. */
export async function deleteDiscountCode(id: string): Promise<void> {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id)
  if (error) throw error
}
