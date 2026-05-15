import type { CSSProperties } from 'react'
import { FiHeart } from 'react-icons/fi'
import { useWishlist } from '../features/wishlist/context/WishlistContext'

type Props = {
  productId: string
  /** Kích thước icon (px) */
  size?: number
  style?: CSSProperties
}

export default function WishlistHeartButton({ productId, size = 22, style }: Props) {
  const { isInWishlist, toggleWishlist } = useWishlist()
  const active = isInWishlist(productId)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void toggleWishlist(productId)
      }}
      aria-label={active ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
      title={active ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: active ? '2px solid #fecaca' : '2px solid #e7e5e4',
        background: 'rgba(255,255,255,0.95)',
        color: active ? '#b91c1c' : '#3C5C2D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        flexShrink: 0,
        ...style,
      }}
    >
      <FiHeart
        size={size}
        style={{
          fill: active ? 'currentColor' : 'none',
        }}
      />
    </button>
  )
}
