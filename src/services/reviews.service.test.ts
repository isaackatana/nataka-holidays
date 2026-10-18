import { describe, it, expect, vi, beforeEach } from 'vitest'

type Result = { data: unknown; error: { code?: string; message?: string } | null }
const calls: string[] = []
let responder: (columns: string) => Result

vi.mock('@/lib/supabase', () => {
  const chain = (columns: string) => {
    const end = () => Promise.resolve(responder(columns))
    const node: Record<string, unknown> = {
      eq: () => node,
      gte: () => node,
      not: () => node,
      limit: end,
      // .order() can be awaited directly or followed by .limit()
      order: () => Object.assign(end(), { limit: end }),
    }
    return node
  }
  return {
    supabase: {
      from: () => ({
        select: (columns: string) => {
          calls.push(columns)
          return chain(columns)
        },
      }),
    },
  }
})

import { getApprovedReviews, getFeaturedReviews, getMyReviews } from './reviews.service'

const missingTable = { code: 'PGRST200', message: 'no relationship between reviews and review_images' }

describe('review lookups when a migration has not been run yet', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('public reviews fall back to plain reviews instead of failing', async () => {
    responder = (cols) =>
      cols.includes('review_images')
        ? { data: null, error: missingTable }
        : { data: [{ id: 'r1', rating: 5, comment: 'Nice', created_at: 'x', profiles: null }], error: null }
    const reviews = await getApprovedReviews('p1')
    expect(reviews).toHaveLength(1)
    expect(reviews[0]).toMatchObject({ id: 'r1', owner_reply: null, review_images: [] })
    expect(calls).toHaveLength(2)
  })

  it("a guest's own reviews fall back the same way", async () => {
    responder = (cols) =>
      cols.includes('review_images')
        ? { data: null, error: missingTable }
        : { data: [{ id: 'r1', booking_id: 'b1', property_id: 'p1', rating: 4, comment: null, status: 'pending', created_at: 'x' }], error: null }
    const reviews = await getMyReviews('u1')
    expect(reviews[0]).toMatchObject({ id: 'r1', review_images: [] })
  })

  it('does not hide other errors', async () => {
    responder = () => ({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(getApprovedReviews('p1')).rejects.toMatchObject({ code: '42501' })
    expect(calls).toHaveLength(1)
  })

  it('makes one request when everything is in place', async () => {
    responder = () => ({ data: [], error: null })
    expect(await getApprovedReviews('p1')).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('home-page reviews fall back to no names if the name column is missing', async () => {
    responder = (cols) =>
      cols.includes('reviewer_name')
        ? { data: null, error: { code: '42703', message: 'column reviewer_name does not exist' } }
        : { data: [{ id: 'r1', rating: 5, comment: 'Lovely', created_at: 'x', properties: { title: 'T', slug: 't' } }], error: null }
    const reviews = await getFeaturedReviews(3)
    expect(reviews[0]).toMatchObject({ id: 'r1', reviewer_name: null })
  })
})
