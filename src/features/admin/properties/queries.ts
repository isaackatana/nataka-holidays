import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAllPropertiesForAdmin,
  getPropertyByIdForAdmin,
  createProperty,
  duplicateProperty,
  updateProperty,
  deleteProperty,
  togglePublished,
  toggleFeatured,
  type PropertyFormInput,
} from '@/services/admin/properties.service'

export function useAdminProperties() {
  return useQuery({
    queryKey: ['admin', 'properties', 'list'],
    queryFn: getAllPropertiesForAdmin,
  })
}

export function useAdminProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'properties', 'detail', id],
    queryFn: () => getPropertyByIdForAdmin(id!),
    enabled: !!id,
  })
}

/** Every mutation below invalidates both the admin list and the public
 * `properties` queries (Home's featured grid, Holiday Homes' listing,
 * property detail pages) — an admin publishing or editing a property
 * should be reflected everywhere immediately, not just in the admin UI. */
function useInvalidatePropertyCaches() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'properties'] })
    queryClient.invalidateQueries({ queryKey: ['properties'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'popular-properties'] })
  }
}

export function useCreateProperty() {
  const invalidate = useInvalidatePropertyCaches()
  return useMutation({
    mutationFn: (input: PropertyFormInput) => createProperty(input),
    onSuccess: invalidate,
  })
}

export function useUpdateProperty() {
  const invalidate = useInvalidatePropertyCaches()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PropertyFormInput }) => updateProperty(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteProperty() {
  const invalidate = useInvalidatePropertyCaches()
  return useMutation({
    mutationFn: (id: string) => deleteProperty(id),
    onSuccess: invalidate,
  })
}

export function useTogglePublished() {
  const invalidate = useInvalidatePropertyCaches()
  return useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => togglePublished(id, isPublished),
    onSuccess: invalidate,
  })
}

export function useToggleFeatured() {
  const invalidate = useInvalidatePropertyCaches()
  return useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) => toggleFeatured(id, isFeatured),
    onSuccess: invalidate,
  })
}

export function useDuplicateProperty() {
  const invalidate = useInvalidatePropertyCaches()
  return useMutation({
    mutationFn: (id: string) => duplicateProperty(id),
    onSuccess: invalidate,
  })
}
