import { formatKES } from '@/utils/currency'
import type { DiscountCode } from '@/types/domain'

export function discountLabel(d: Pick<DiscountCode, 'kind' | 'value'>): string {
  return d.kind === 'percent' ? `${d.value}% off` : `${formatKES(d.value)} off`
}

export type DiscountState = 'on' | 'off' | 'expired' | 'used-up'

/** Why a code does or does not work right now, for the admin list. */
export function discountState(d: DiscountCode, now = Date.now()): DiscountState {
  if (!d.is_active) return 'off'
  if (d.expires_at && new Date(d.expires_at).getTime() <= now) return 'expired'
  if (d.max_uses !== null && d.uses >= d.max_uses) return 'used-up'
  return 'on'
}
