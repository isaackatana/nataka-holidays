import { describe, it, expect, vi, beforeEach } from 'vitest'

type Result = { data: unknown; error: { code?: string; message?: string } | null }
const calls: string[] = []
let responder: (columns: string) => Result

vi.mock('@/lib/supabase', () => {
  const chain = (columns: string) => {
    const result = () => Promise.resolve(responder(columns))
    const node: Record<string, unknown> = {}
    for (const name of ['eq', 'ilike', 'gte', 'lte', 'or', 'not']) node[name] = () => node
    node.order = () => Object.assign(result(), { limit: result })
    node.single = result
    // lets `await query` work when the chain ends without order()/single()
    node.then = (resolve: (r: Result) => unknown) => result().then(resolve)
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

import { getExperienceBySlug, getExperienceCategoriesInUse, getPublishedExperiences } from './experiences.service'

const missingColumn = { code: '42703', message: 'column experiences.price_type does not exist' }

describe('experience lookups before migration 0025 has been run', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('with 0025 run but not 0027, falls back one step and keeps the details', async () => {
    responder = (cols) =>
      cols.includes('deposit_percent')
        ? { data: null, error: { code: '42703', message: 'column deposit_percent does not exist' } }
        : { data: [{ id: 'e1', title: 'Dhow Trip', category: 'water' }], error: null }
    const list = await getPublishedExperiences()
    expect(list[0]).toMatchObject({ category: 'water' })
    expect(calls).toHaveLength(2)
    expect(calls[1]).toContain('category')
  })

  it('the list falls back to the basic columns instead of failing', async () => {
    responder = (cols) =>
      cols.includes('price_type')
        ? { data: null, error: missingColumn }
        : { data: [{ id: 'e1', title: 'Dhow Trip' }], error: null }
    const list = await getPublishedExperiences({ category: 'water' })
    expect(list).toHaveLength(1)
    expect(calls).toHaveLength(3) // newest columns, then 0025's, then the basics
  })

  it('a single experience page falls back the same way', async () => {
    responder = (cols) =>
      cols.includes('price_type')
        ? { data: null, error: missingColumn }
        : { data: { id: 'e1', title: 'Dhow Trip' }, error: null }
    expect(await getExperienceBySlug('dhow-trip')).toMatchObject({ id: 'e1' })
  })

  it('category chips are simply absent', async () => {
    responder = () => ({ data: null, error: missingColumn })
    expect(await getExperienceCategoriesInUse()).toEqual([])
  })

  it('does not hide other errors', async () => {
    responder = () => ({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(getPublishedExperiences()).rejects.toMatchObject({ code: '42501' })
    expect(calls).toHaveLength(1)
  })

  it('lists the distinct categories in use', async () => {
    responder = () => ({ data: [{ category: 'water' }, { category: 'water' }, { category: 'food' }], error: null })
    expect((await getExperienceCategoriesInUse()).sort()).toEqual(['food', 'water'])
  })
})
