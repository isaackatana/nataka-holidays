export const EXPERIENCE_CATEGORIES = [
  { value: 'water', label: 'On the water' },
  { value: 'safari', label: 'Safari & wildlife' },
  { value: 'culture', label: 'Culture & history' },
  { value: 'food', label: 'Food & drink' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'other', label: 'Other' },
] as const

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number]['value']
export type ExperiencePriceType = 'per_person' | 'per_group'

export function categoryLabel(value: string | null | undefined): string | null {
  return EXPERIENCE_CATEGORIES.find((c) => c.value === value)?.label ?? null
}

/** "per person" / "per group", or empty when the admin hasn't said. */
export function priceBasisLabel(priceType: string | null | undefined): string {
  if (priceType === 'per_person') return 'per person'
  if (priceType === 'per_group') return 'per group'
  return ''
}

/**
 * What a request would cost, for showing the guest as they choose how many
 * people are coming. Returns null when we can't say (no price, or the price
 * basis isn't set), in which case the guest is told we'll confirm the total.
 * The database works out the figure it actually stores; this is only a preview.
 */
export function estimateExperienceTotal(
  price: number | null | undefined,
  priceType: string | null | undefined,
  people: number,
): number | null {
  if (price === null || price === undefined || !priceType || !Number.isFinite(people) || people < 1) return null
  return priceType === 'per_group' ? price : price * people
}
