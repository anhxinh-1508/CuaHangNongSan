import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiLock, FiShoppingBag, FiShoppingCart, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../features/auth/context/AuthContext'
import api from '../api/client'
import { unwrapData } from '../api/mappers'
import { dispatchCartUpdated } from '../utils/cartEvents'
import { useResponsive } from '../hooks/useResponsive'
import type { CheckoutLine } from './CheckoutPage'

const FREE_SHIPPING_SUBTOTAL_MIN = 300_000
const SHIPPING_FEE = 20_000

type CartItem = { productId: string; productName: string; imageUrl?: string; price: number; quantity: number }

export default function CartPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<CartItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const { isMobile } = useResponsive()

  const loadCart = async () => {
    try {
      const r = await api.get('/cart')
      const payload = unwrapData<any>(r.data, { items: [] })
      const mapped = ((payload?.items ?? []) as any[]).map((item) => ({
        productId: item.productId,
        productName: item.product?.name ?? 'Sản phẩm',
        imageUrl: item.product?.images?.[0]?.secure_url ?? item.product?.imageUrl,
        price: item.product?.salePrice ?? item.product?.price ?? 0,
        quantity: item.quantity ?? 1,
      }))
      setItems(mapped)
      setError('')
      dispatchCartUpdated()
    } catch {
      setError('Không thể tải giỏ hàng. Vui lòng tải lại.')
    }
  }

  useEffect(() => {
    if (!user) return
    loadCart()
  }, [user])

  useEffect(() => {
    setSelectedIds(new Set(items.map((i) => i.productId)))
  }, [items])

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.productId)),
    [items, selectedIds]
  )

  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const shippingFee = subtotal >= FREE_SHIPPING_SUBTOTAL_MIN ? 0 : SHIPPING_FEE
  const orderTotal = subtotal + shippingFee
  const untilFreeShip = Math.max(0, FREE_SHIPPING_SUBTOTAL_MIN - subtotal)
  const showFreeShipHint = shippingFee > 0 && subtotal > 0

  const allSelected = items.length > 0 && selectedIds.size === items.length

  const toggleSelect = (productId: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(productId)) n.delete(productId)
      else n.add(productId)
      return n
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (allSelected) return new Set()
      return new Set(items.map((i) => i.productId))
    })
  }

  const updateQty = (productId: string, qty: number) => {
    api.post('/cart/items', { productId, quantity: qty }).then(() => loadCart()).catch(() => setError('Không thể cập nhật số lượng'))
  }

  const remove = (productId: string) => {
    api
      .delete(`/cart/items/${productId}`)
      .then(() => loadCart())
      .catch(() => setError('Không thể xóa sản phẩm khỏi giỏ'))
  }

  const goCheckout = () => {
    if (!user || selectedItems.length === 0) return
    const lines: CheckoutLine[] = selectedItems.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      imageUrl: i.imageUrl,
      price: i.price,
      quantity: i.quantity,
    }))
    navigate('/checkout', { state: { lines } })
  }

  if (!user) {
    return (
      <div
        style={{
          maxWidth: 600,
          margin: '80px auto',
          padding: 48,
          textAlign: 'center',
          background: '#fff',
          borderRadius: 20,
          border: '2px solid #e7e5e4',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
          <FiLock />
        </div>
        <h2 style={{ color: '#3C5C2D', marginBottom: 16 }}>Vui lòng đăng nhập</h2>
        <p style={{ color: '#737373', marginBottom: 24 }}>Bạn cần đăng nhập để xem giỏ hàng</p>
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
            color: '#fff',
            borderRadius: 12,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(60, 92, 45, 0.3)',
          }}
        >
          Đăng nhập ngay
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          maxWidth: 600,
          margin: '80px auto',
          padding: 48,
          textAlign: 'center',
          background: '#fff',
          borderRadius: 20,
          border: '2px solid #e7e5e4',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
          <FiShoppingCart />
        </div>
        <h2 style={{ color: '#3C5C2D', marginBottom: 16 }}>Giỏ hàng trống</h2>
        <p style={{ color: '#737373', marginBottom: 24 }}>Hãy khám phá các sản phẩm hữu cơ của chúng tôi</p>
        <Link
          to="/products"
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            background: 'linear-gradient(135deg, #E2A227 0%, #f0b844 100%)',
            color: '#fff',
            borderRadius: 12,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(226, 162, 39, 0.3)',
          }}
        >
          Mua sắm ngay
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}
      <h1
        style={{
          marginBottom: isMobile ? 24 : 32,
          fontSize: isMobile ? 24 : 32,
          fontWeight: 700,
          color: '#3C5C2D',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: isMobile ? 28 : 36, display: 'flex' }}>
          <FiShoppingCart />
        </span>
        Giỏ hàng của bạn
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? 24 : 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: '#f0f9f4',
              border: '1px solid #3C5C2D',
              borderRadius: 12,
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ width: 20, height: 20, accentColor: '#3C5C2D', cursor: 'pointer' }}
              aria-label="Chọn tất cả sản phẩm để thanh toán"
            />
            <span style={{ fontWeight: 600, color: '#3C5C2D', fontSize: 14 }}>
              Chọn sản phẩm để thanh toán ({selectedIds.size}/{items.length})
            </span>
          </div>

          {items.map((i) => (
            <div
              key={i.productId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 20,
                background: '#fff',
                border: '2px solid #e7e5e4',
                borderRadius: 16,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s',
                opacity: selectedIds.has(i.productId) ? 1 : 0.72,
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(i.productId)}
                onChange={() => toggleSelect(i.productId)}
                style={{ width: 22, height: 22, accentColor: '#3C5C2D', cursor: 'pointer', flexShrink: 0 }}
                aria-label={`Chọn ${i.productName}`}
              />
              <div
                style={{
                  width: 100,
                  height: 100,
                  background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
                  borderRadius: 12,
                  border: '2px solid #E2A227',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {i.imageUrl ? (
                  <img src={i.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                    <FiShoppingBag />
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  to={`/products/${i.productId}`}
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    color: '#1a1a1a',
                    textDecoration: 'none',
                  }}
                >
                  {i.productName}
                </Link>
                <p style={{ margin: '8px 0 0', color: '#E2A227', fontWeight: 700, fontSize: 20 }}>
                  {i.price?.toLocaleString()}đ
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => updateQty(i.productId, Math.max(1, i.quantity - 1))}
                  style={{
                    width: 36,
                    height: 36,
                    background: '#fff',
                    border: '2px solid #3C5C2D',
                    borderRadius: 8,
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#3C5C2D',
                    cursor: 'pointer',
                  }}
                >
                  −
                </button>
                <span style={{ minWidth: 40, textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#3C5C2D' }}>
                  {i.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(i.productId, i.quantity + 1)}
                  style={{
                    width: 36,
                    height: 36,
                    background: '#fff',
                    border: '2px solid #3C5C2D',
                    borderRadius: 8,
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#3C5C2D',
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => remove(i.productId)}
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  color: '#dc2626',
                  border: '2px solid #dc2626',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FiTrash2 /> Xóa
                </span>
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
            padding: 32,
            borderRadius: 20,
            border: '3px solid #E2A227',
            boxShadow: '0 8px 24px rgba(226, 162, 39, 0.15)',
            height: 'fit-content',
            position: 'sticky',
            top: 120,
          }}
        >
          <h3
            style={{
              margin: '0 0 20px',
              fontSize: 22,
              fontWeight: 700,
              color: '#3C5C2D',
              borderBottom: '2px solid #E2A227',
              paddingBottom: 16,
            }}
          >
            Tóm tắt (đã chọn)
          </h3>

          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#57534e', lineHeight: 1.5 }}>
            Mã giảm giá và phương thức thanh toán được nhập ở bước tiếp theo.
          </p>

          <div
            style={{
              background: '#fff',
              padding: 20,
              borderRadius: 12,
              marginBottom: 20,
              border: '2px solid #e7e5e4',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#737373' }}>Tạm tính (đã chọn):</span>
              <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{subtotal.toLocaleString()}đ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#737373' }}>Phí vận chuyển (ước tính):</span>
              <span style={{ fontWeight: 600, color: shippingFee > 0 ? '#1a1a1a' : '#3C5C2D' }}>
                {shippingFee > 0 ? `${shippingFee.toLocaleString()}đ` : 'Miễn phí'}
              </span>
            </div>
            {showFreeShipHint && untilFreeShip > 0 && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#b45309', lineHeight: 1.4 }}>
                Mua thêm <strong>{untilFreeShip.toLocaleString()}đ</strong> (trong phần đã chọn) để được miễn phí giao hàng.
              </p>
            )}
            <div
              style={{
                borderTop: '2px solid #e7e5e4',
                paddingTop: 12,
                marginTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: '#3C5C2D' }}>Tạm tính cộng ship:</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#E2A227' }}>{orderTotal.toLocaleString()}đ</span>
            </div>
          </div>

          <button
            type="button"
            onClick={goCheckout}
            disabled={selectedItems.length === 0}
            style={{
              width: '100%',
              padding: '16px 24px',
              background: selectedItems.length === 0 ? '#d4d4d8' : 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: selectedItems.length === 0 ? 'none' : '0 4px 12px rgba(60, 92, 45, 0.3)',
            }}
          >
            Tiến hành thanh toán
          </button>
        </div>
      </div>
    </div>
  )
}
