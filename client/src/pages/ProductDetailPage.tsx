import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FiBox, FiCheck, FiChevronLeft, FiChevronRight, FiShoppingBag, FiShoppingCart, FiZap } from 'react-icons/fi'
import { useAuth } from '../features/auth/context/AuthContext'
import api from '../api/client'
import { mapProduct, unwrapData, type UiProduct } from '../api/mappers'
import { dispatchCartUpdated } from '../utils/cartEvents'
import { useResponsive } from '../hooks/useResponsive'
import WishlistHeartButton from '../components/WishlistHeartButton'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [product, setProduct] = useState<UiProduct | null>(null)
  const [recommended, setRecommended] = useState<UiProduct[]>([])
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { isMobile } = useResponsive()
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/products/${id}`).then((r) => {
      const data = unwrapData<any>(r.data, null)
      if (!data) return
      setProduct(mapProduct(data))
      setRecommended((data.relatedProducts ?? []).map(mapProduct))
    }).catch(() => setError('Không tải được chi tiết sản phẩm.')).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setActiveImage(0)
  }, [id])

  const addToCart = () => {
    if (!user) {
      window.location.href = '/login'
      return
    }
    if (!id || (product?.stock ?? 0) < 1) {
      alert('Sản phẩm tạm hết hàng.')
      return
    }
    api.post('/cart/items', { productId: id, quantity: qty, merge: true }).then(() => {
      dispatchCartUpdated()
      alert('Đã thêm vào giỏ hàng')
    }).catch((e) => {
      alert(e?.response?.data?.message ?? 'Không thể thêm vào giỏ hàng')
    })
  }

  const buyNow = () => {
    if (!user) {
      window.location.href = '/login'
      return
    }
    if (!id || (product?.stock ?? 0) < 1) {
      alert('Sản phẩm tạm hết hàng.')
      return
    }
    api
      .post('/cart/items', { productId: id, quantity: qty, merge: true })
      .then(() => {
        dispatchCartUpdated()
        navigate('/cart')
      })
      .catch((e) => {
        alert(e?.response?.data?.message ?? 'Không thể thực hiện mua ngay')
      })
  }

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>
  if (error) return <div style={{ padding: 24, color: '#dc2626' }}>{error}</div>
  if (!product) return <div style={{ padding: 24 }}>Không tìm thấy sản phẩm.</div>
  const stock = product.stock ?? 0
  const useTags = product.useTags ?? []
  const gallery =
    product.imageUrls && product.imageUrls.length > 0
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : []
  const canSlide = gallery.length > 1
  const goPrev = () => {
    if (!canSlide) return
    setActiveImage((i) => (i - 1 + gallery.length) % gallery.length)
  }
  const goNext = () => {
    if (!canSlide) return
    setActiveImage((i) => (i + 1) % gallery.length)
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
        gap: isMobile ? 32 : 56, 
        marginBottom: isMobile ? 40 : 64,
        background: '#fff',
        padding: isMobile ? 24 : 40,
        borderRadius: isMobile ? 16 : 20,
        border: '2px solid #e7e5e4',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              position: 'relative',
              aspectRatio: 1,
              background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
              borderRadius: 16,
              border: '3px solid #E2A227',
              overflow: 'hidden',
              boxShadow: '0 8px 16px rgba(226, 162, 39, 0.2)',
            }}
          >
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 8 }}>
              <WishlistHeartButton productId={product.id} />
            </div>
            {gallery.length > 0 ? (
              <>
                <img
                  src={gallery[activeImage]}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {canSlide && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      aria-label="Ảnh trước"
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        border: '2px solid #E2A227',
                        background: 'rgba(255, 255, 255, 0.92)',
                        color: '#3C5C2D',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                      }}
                    >
                      <FiChevronLeft size={24} />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      aria-label="Ảnh sau"
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        border: '2px solid #E2A227',
                        background: 'rgba(255, 255, 255, 0.92)',
                        color: '#3C5C2D',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                      }}
                    >
                      <FiChevronRight size={24} />
                    </button>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '6px 12px',
                        borderRadius: 20,
                        background: 'rgba(60, 92, 45, 0.85)',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {activeImage + 1} / {gallery.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 120,
                }}
              >
                <FiShoppingBag />
              </div>
            )}
          </div>
          {canSlide && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 4,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {gallery.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Xem ảnh ${i + 1}`}
                  style={{
                    flex: '0 0 auto',
                    width: isMobile ? 64 : 76,
                    height: isMobile ? 64 : 76,
                    padding: 0,
                    borderRadius: 10,
                    border: i === activeImage ? '3px solid #E2A227' : '2px solid #e7e5e4',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: '#fffbf0',
                    boxShadow: i === activeImage ? '0 2px 8px rgba(226, 162, 39, 0.35)' : 'none',
                  }}
                >
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} title={`${product.name} — ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ 
            margin: '0 0 20px', 
            fontSize: isMobile ? 24 : 36, 
            fontWeight: 700, 
            color: '#3C5C2D',
            lineHeight: 1.2
          }}>
            {product.name}
          </h1>
          
          <div style={{ 
            display: 'inline-block',
            padding: isMobile ? '10px 20px' : '12px 24px', 
            background: 'linear-gradient(135deg, #E2A227 0%, #f0b844 100%)', 
            color: '#fff',
            borderRadius: 12,
            marginBottom: 24,
            fontSize: isMobile ? 24 : 32,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(226, 162, 39, 0.3)',
            width: 'fit-content'
          }}>
            {product.price?.toLocaleString()}đ
          </div>
          
          {useTags.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {useTags.map((t) => (
                <span 
                  key={t} 
                  style={{ 
                    padding: '8px 16px', 
                    background: '#f0f9f4',
                    border: '2px solid #3C5C2D',
                    color: '#3C5C2D', 
                    borderRadius: 20, 
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiCheck /> {t}</span>
                </span>
              ))}
            </div>
          )}
          
          <p style={{ 
            color: '#525252', 
            marginBottom: 24, 
            fontSize: 16, 
            lineHeight: 1.7,
            padding: 20,
            background: '#fafaf9',
            borderRadius: 12,
            borderLeft: '4px solid #E2A227'
          }}>
            {product.description || 'Nông sản hữu cơ chất lượng cao, được trồng và chăm sóc theo tiêu chuẩn VietGAP.'}
          </p>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            padding: 16,
            background: '#fffbf0',
            borderRadius: 12,
            marginBottom: 28,
            border: '2px solid #E2A227'
          }}>
            <span style={{ fontSize: 24, display: 'flex' }}><FiBox /></span>
            <div>
              <p style={{ margin: 0, fontSize: 14, color: '#737373' }}>Tồn kho</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#3C5C2D' }}>{stock} sản phẩm</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={stock < 1}
                style={{
                  width: 40,
                  height: 40,
                  background: '#fff',
                  border: '2px solid #3C5C2D',
                  borderRadius: 10,
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#3C5C2D',
                  cursor: stock < 1 ? 'not-allowed' : 'pointer',
                  opacity: stock < 1 ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, stock)}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(stock || 1, parseInt(e.target.value) || 1)))}
                disabled={stock < 1}
                style={{ 
                  width: 70, 
                  padding: '10px 12px', 
                  borderRadius: 10, 
                  border: '2px solid #e7e5e4',
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: 600,
                  outline: 'none',
                  opacity: stock < 1 ? 0.6 : 1,
                }}
              />
              <button
                type="button"
                onClick={() => setQty(Math.min(stock || 1, qty + 1))}
                disabled={stock < 1}
                style={{
                  width: 40,
                  height: 40,
                  background: '#fff',
                  border: '2px solid #3C5C2D',
                  borderRadius: 10,
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#3C5C2D',
                  cursor: stock < 1 ? 'not-allowed' : 'pointer',
                  opacity: stock < 1 ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button
                type="button"
                onClick={addToCart}
                disabled={stock < 1}
                style={{
                  flex: '1 1 200px',
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  cursor: stock < 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: 16,
                  opacity: stock < 1 ? 0.55 : 1,
                  boxShadow: stock < 1 ? 'none' : '0 4px 12px rgba(60, 92, 45, 0.3)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%' }}>
                  <FiShoppingCart /> Thêm vào giỏ hàng
                </span>
              </button>
              <button
                type="button"
                onClick={buyNow}
                disabled={stock < 1}
                style={{
                  flex: '1 1 200px',
                  padding: '14px 24px',
                  background: stock < 1 ? '#e7e5e4' : 'linear-gradient(135deg, #E2A227 0%, #f0b844 100%)',
                  color: stock < 1 ? '#a8a29e' : '#fff',
                  border: stock < 1 ? '2px solid #d6d3d1' : 'none',
                  borderRadius: 12,
                  cursor: stock < 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: stock < 1 ? 'none' : '0 4px 12px rgba(226, 162, 39, 0.35)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%' }}>
                  <FiZap /> Mua ngay
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {recommended.length > 0 && (
        <section style={{ 
          background: '#fafaf9',
          padding: 48,
          borderRadius: 20,
          border: '2px solid #e7e5e4'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#3C5C2D', margin: '0 0 12px' }}>
              Sản phẩm gợi ý cho bạn
            </h2>
            <div style={{ width: 80, height: 4, background: 'linear-gradient(90deg, #E2A227 0%, #3C5C2D 100%)', margin: '0 auto', borderRadius: 2 }}></div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
            {recommended.map((p) => (
              <a key={p.id} href={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ 
                  background: '#fff', 
                  border: '2px solid #e7e5e4', 
                  borderRadius: 16, 
                  overflow: 'hidden',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)'
                }}>
                  <div style={{ aspectRatio: '4/3', background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)' }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
                        <FiShoppingBag />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 16 }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600 }}>{p.name}</h3>
                    <p style={{ margin: 0, fontWeight: 700, color: '#E2A227', fontSize: 18 }}>
                      {p.price?.toLocaleString()}đ
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
