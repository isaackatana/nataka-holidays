import { useQuery } from '@tanstack/react-query'
import {
  getPublishedExperiences,
  getExperienceBySlug,
  type ExperienceFilters,
} from '@/services/experiences.service'

/** Most-recent-N, no filtering — used by the homepage's preview section. */
export function useExperiences(limit?: number) {
  return useQuery({
    queryKey: ['experiences', 'list', limit],
    queryFn: () => getPublishedExperiences(limit),
  })
}

/** Filtered list for the Experiences page. Kept separate from
 * useExperiences rather than overloading it, so the two have distinct
 * query keys and a filter change can't invalidate the homepage's cache
 * (or vice versa). */
export function useFilteredExperiences(filters: ExperienceFilters = {}) {
  return useQuery({
    queryKey: ['experiences', 'filtered', filters],
    queryFn: () => getPublishedExperiences(filters),
  })
}

export function useExperienceBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['experiences', 'detail', slug],
    queryFn: () => getExperienceBySlug(slug!),
    enabled: !!slug,
  })
}
