import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import api from '../../../api/client'
import { mapProduct, unwrapData, type UiProduct } from '../../../api/mappers'
import { useAuth } from '../../auth/context/AuthContext'

type WishlistContextType = {
  items: UiProduct[]
  count: number
  loading: boolean
  refreshWishlist: () => Promise<void>
  isInWishlist: (productId: string) => boolean
  toggleWishlist: (productId: string) => Promise<void>
  removeFromWishlist: (productId: string) => Promise<void>
}

const WishlistContext = createContext<WishlistContextType | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth()
  const [items, setItems] = useState<UiProduct[]>([])
  const [loading, setLoading] = useState(false)

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const r = await api.get('/wishlist')
      const data = unwrapData<any>(r.data, { productIds: [] })
      const raw = data?.productIds ?? []
      setItems(raw.map((p: unknown) => mapProduct(p)))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authReady) return
    refreshWishlist()
  }, [authReady, user, refreshWishlist])

  const isInWishlist = useCallback(
    (productId: string) => items.some((p) => p.id === productId),
    [items]
  )

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) {
        window.location.href = '/login'
        return
      }
      try {
        if (isInWishlist(productId)) {
          await api.delete(`/wishlist/items/${productId}`)
        } else {
          await api.post('/wishlist/items', { productId })
        }
        await refreshWishlist()
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        alert(err.response?.data?.message ?? 'Không thể cập nhật danh sách yêu thích')
      }
    },
    [user, isInWishlist, refreshWishlist]
  )

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      if (!user) return
      try {
        await api.delete(`/wishlist/items/${productId}`)
        await refreshWishlist()
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        alert(err.response?.data?.message ?? 'Không thể xóa khỏi yêu thích')
      }
    },
    [user, refreshWishlist]
  )

  const value = useMemo(
    () => ({
      items,
      count: items.length,
      loading,
      refreshWishlist,
      isInWishlist,
      toggleWishlist,
      removeFromWishlist,
    }),
    [items, loading, refreshWishlist, isInWishlist, toggleWishlist, removeFromWishlist]
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
