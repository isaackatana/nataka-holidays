import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PropertyCard } from './PropertyCard'
import type { Property } from '@/types/domain'

let ratings: Record<string, { property_id: string; average: number; review_count: number }> | undefined

vi.mock('@/features/reviews/queries', () => ({
  usePropertyRatings: () => ({ data: ratings }),
}))
vi.mock('@/features/tripCart/TripCartContext', () => ({
  useTripCart: () => ({
    addProperty: vi.fn(),
    removeProperty: vi.fn(),
    isPropertyInCart: () => false,
  }),
}))

const property = {
  id: 'p1', title: 'Beach Villa', slug: 'beach-villa', location: 'Diani', bedrooms: 3,
  max_guests: 6, price_per_night: 15000, is_featured: false, property_images: [],
} as unknown as Property

function renderCard() {
  return render(
    <MemoryRouter>
      <PropertyCard property={property} />
    </MemoryRouter>,
  )
}

describe('PropertyCard rating', () => {
  afterEach(() => cleanup())

  it('shows the average and review count when the property has approved reviews', () => {
    ratings = { p1: { property_id: 'p1', average: 4.5, review_count: 2 } }
    renderCard()
    expect(screen.getByLabelText('Rated 4.5 out of 5 from 2 reviews')).toBeTruthy()
    expect(screen.getByText('4.5')).toBeTruthy()
  })

  it('uses the singular for one review', () => {
    ratings = { p1: { property_id: 'p1', average: 5, review_count: 1 } }
    renderCard()
    expect(screen.getByLabelText('Rated 5.0 out of 5 from 1 review')).toBeTruthy()
  })

  it('shows nothing when there are no reviews or ratings have not loaded', () => {
    ratings = {}
    renderCard()
    expect(screen.queryByLabelText(/Rated/)).toBeNull()
    cleanup()
    ratings = undefined
    renderCard()
    expect(screen.queryByLabelText(/Rated/)).toBeNull()
  })
})
