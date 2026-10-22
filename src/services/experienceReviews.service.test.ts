import { describe, it, expect, vi } from 'vitest'

type Result = { data: unknown; error: { code?: string } | null }
let result: Result

vi.mock('@/lib/supabase', () => {
  const chain = (): Record<string, unknown> => {
    const node: Record<string, unknown> = {}
    node.eq = () => node
    node.order = () => Promise.resolve(result)
    return node
  }
  return {
    supabase: {
      from: () => ({ select: () => chain() }),
      rpc: () => Promise.resolve(result),
    },
  }
})

import {
  getApprovedExperienceReviews,
  getExperienceRatings,
  getMyExperienceReviews,
} from './experienceReviews.service'

describe('experience review lookups', () => {
  it('show nothing, not an error, before migration 0026 has been run', async () => {
    result = { data: null, error: { code: '42P01' } }
    expect(await getApprovedExperienceReviews('e1')).toEqual([])
    expect(await getMyExperienceReviews('u1')).toEqual([])
    result = { data: null, error: { code: 'PGRST205' } }
    expect(await getApprovedExperienceReviews('e1')).toEqual([])
  })

  it('do not hide other errors', async () => {
    result = { data: null, error: { code: '42501' } }
    await expect(getApprovedExperienceReviews('e1')).rejects.toMatchObject({ code: '42501' })
  })

  it('turn the rating stats into a lookup by experience', async () => {
    result = { data: [{ experience_id: 'e1', average: '4.5', review_count: 2 }], error: null }
    expect(await getExperienceRatings()).toEqual({ e1: { experience_id: 'e1', average: 4.5, review_count: 2 } })
  })
})
