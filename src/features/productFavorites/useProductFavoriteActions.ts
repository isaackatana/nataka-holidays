import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useProductFavoriteIds, useToggleProductFavorite } from '@/features/productFavorites/queries'

/** Whether each product is saved, plus a toggle that sends signed-out visitors to sign in first. */
export function useProductFavoriteActions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: ids } = useProductFavoriteIds(user?.id)
  const toggle = useToggleProductFavorite(user?.id)
  const saved = new Set(ids ?? [])

  return {
    isSaved: (productId: string) => saved.has(productId),
    toggle: (productId: string) => {
      if (!user) {
        navigate('/login', { state: { redirectTo: location.pathname + location.search } })
        return
      }
      toggle.mutate({ productId, saved: saved.has(productId) })
    },
    error: toggle.error as Error | null,
  }
}
