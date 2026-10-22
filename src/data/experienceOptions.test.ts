import { describe, it, expect } from 'vitest'
import { categoryLabel, estimateExperienceTotal, priceBasisLabel } from './experienceOptions'

describe('estimateExperienceTotal', () => {
  it('multiplies per-person prices by the group size', () => {
    expect(estimateExperienceTotal(5000, 'per_person', 3)).toBe(15000)
  })
  it('charges a per-group price once', () => {
    expect(estimateExperienceTotal(20000, 'per_group', 5)).toBe(20000)
  })
  it('gives no estimate when the price or its basis is unknown, or the group size is invalid', () => {
    expect(estimateExperienceTotal(null, 'per_person', 2)).toBeNull()
    expect(estimateExperienceTotal(3000, null, 2)).toBeNull()
    expect(estimateExperienceTotal(3000, 'per_person', 0)).toBeNull()
    expect(estimateExperienceTotal(3000, 'per_person', Number.NaN)).toBeNull()
  })
})

describe('labels', () => {
  it('names categories and price bases', () => {
    expect(categoryLabel('water')).toBe('On the water')
    expect(categoryLabel('nope')).toBeNull()
    expect(priceBasisLabel('per_person')).toBe('per person')
    expect(priceBasisLabel(null)).toBe('')
  })
})
