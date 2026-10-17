export interface RatingBucket {
  stars: 1 | 2 | 3 | 4 | 5
  count: number
  /** Share of all reviews, 0-100 (rounded). */
  percent: number
}

/** How many reviews gave each star rating, listed 5 stars down to 1. */
export function ratingBreakdown(ratings: number[]): RatingBucket[] {
  const total = ratings.length
  return ([5, 4, 3, 2, 1] as const).map((stars) => {
    const count = ratings.filter((r) => Math.round(r) === stars).length
    return { stars, count, percent: total === 0 ? 0 : Math.round((count / total) * 100) }
  })
}
