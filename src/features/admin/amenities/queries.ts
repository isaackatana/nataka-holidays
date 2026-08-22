import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAllAmenitiesAdmin,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  type AmenityInput,
} from '@/services/admin/amenities.service'

export function useAdminAmenities() {
  return useQuery({
    queryKey: ['admin', 'amenities'],
    queryFn: getAllAmenitiesAdmin,
  })
}

function useInvalidateAmenityCaches() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'amenities'] })
    // FilterPanel (Holiday Homes search) and PropertyEditor's amenity
    // checkboxes both read the public useAmenities() hook, keyed
    // ['amenities'] (features/properties/queries.ts) — changes made here
    // need to reach both, not just the admin table.
    queryClient.invalidateQueries({ queryKey: ['amenities'] })
  }
}

export function useCreateAmenity() {
  const invalidate = useInvalidateAmenityCaches()
  return useMutation({
    mutationFn: (input: AmenityInput) => createAmenity(input),
    onSuccess: invalidate,
  })
}

export function useUpdateAmenity() {
  const invalidate = useInvalidateAmenityCaches()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AmenityInput }) => updateAmenity(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteAmenity() {
  const invalidate = useInvalidateAmenityCaches()
  return useMutation({
    mutationFn: (id: string) => deleteAmenity(id),
    onSuccess: invalidate,
  })
}
