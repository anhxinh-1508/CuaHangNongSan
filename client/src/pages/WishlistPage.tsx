import { Link } from 'react-router-dom'
import { FiHeart, FiShoppingBag, FiShoppingCart, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../features/auth/context/AuthContext'
import { useWishlist } from '../features/wishlist/context/WishlistContext'
import api from '../api/client'
import { useResponsive } from '../hooks/useResponsive'
import { dispatchCartUpdated } from '../utils/cartEvents'

export default function WishlistPage() {
  const { user } = useAuth()
  const { items, loading, removeFromWishlist } = useWishlist()
  const { isMobile } = useResponsive()

  const addToCart = (productId: string) => {
    if (!user) return
    api
      .post('/cart/items', { productId, quantity: 1, merge: true })
      .then(() => {
        dispatchCartUpdated()
        alert('Đã thêm vào giỏ hàng')
      })
      .catch((e) => alert(e?.response?.data?.message ?? 'Không thể thêm vào giỏ'))
  }

  if (!user) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: '64px auto',
          padding: 48,
          textAlign: 'center',
          background: '#fff',
          borderRadius: 16,
          border: '2px solid #e7e5e4',
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16, display: 'flex', justifyContent: 'center', color: '#3C5C2D' }}>
          <FiHeart />
        </div>
        <h1 style={{ fontSize: 22, color: '#3C5C2D', marginBottom: 12 }}>Yêu thích</h1>
        <p style={{ color: '#737373', marginBottom: 24 }}>Đăng nhập để xem sản phẩm bạn đã lưu.</p>
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
            color: '#fff',
            borderRadius: 12,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      <div style={{ marginBottom: isMobile ? 24 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: '#3C5C2D', margin: '0 0 8px' }}>Sản phẩm yêu thích</h1>
        <p style={{ margin: 0, color: '#737373', fontSize: 15 }}>
          {loading ? 'Đang tải...' : `${items.length} sản phẩm đã lưu`}
        </p>
      </div>

      {loading && items.length === 0 ? (
        <p style={{ color: '#737373' }}>Đang tải danh sách...</p>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 56,
            background: '#fafaf9',
            borderRadius: 16,
            border: '2px dashed #e7e5e4',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16, display: 'flex', justifyContent: 'center', color: '#d6d3d1' }}>
            <FiHeart />
          </div>
          <p style={{ fontSize: 17, color: '#57534e', marginBottom: 20 }}>Bạn chưa lưu sản phẩm nào.</p>
          <Link
            to="/products"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#E2A227',
              color: '#fff',
              borderRadius: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24,
          }}
        >
          {items.map((p) => (
            <div
              key={p.id}
              style={{
                background: '#fff',
                border: '2px solid #e7e5e4',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ aspectRatio: '4/3', background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)' }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                      <FiShoppingBag />
                    </div>
                  )}
                </div>
              </Link>
              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: '#1a1a1a' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{p.name}</h3>
                </Link>
                <p style={{ margin: 0, fontWeight: 700, color: '#E2A227', fontSize: 18 }}>{p.price?.toLocaleString()}đ</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => addToCart(p.id)}
                    style={{
                      flex: 1,
                      minWidth: 120,
                      padding: '10px 14px',
                      border: 'none',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <FiShoppingCart size={18} /> Giỏ hàng
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromWishlist(p.id)}
                    title="Xóa khỏi yêu thích"
                    style={{
                      padding: '10px 14px',
                      border: '2px solid #fecaca',
                      borderRadius: 10,
                      background: '#fff',
                      color: '#b91c1c',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
