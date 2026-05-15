import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiMapPin, FiPackage, FiShoppingBag } from 'react-icons/fi'
import api from '../api/client'
import { mapAdminOrder, unwrapData, type UiAdminOrder } from '../api/mappers'
import { useAuth } from '../features/auth/context/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import { ORDER_STATUS_VI, formatOrderPayment, statusBadgeColor } from '../utils/orderDisplay'

export default function StoreOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, authReady } = useAuth()
  const [order, setOrder] = useState<UiAdminOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const { isMobile } = useResponsive()

  useEffect(() => {
    if (!authReady || !user || !id) return
    setLoading(true)
    api
      .get(`/orders/${id}`)
      .then((r) => {
        const raw = unwrapData<any>(r.data, null)
        if (!raw) {
          setOrder(null)
          setError('Không có dữ liệu đơn hàng.')
          return
        }
        setOrder(mapAdminOrder(raw))
        setError('')
      })
      .catch(() => {
        setOrder(null)
        setError('Không tìm thấy đơn hàng hoặc bạn không có quyền xem.')
      })
      .finally(() => setLoading(false))
  }, [authReady, user, id])

  const cancelOrder = async () => {
    if (!id || !order || order.status !== 'Pending') return
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return
    setCancelling(true)
    try {
      await api.post(`/orders/${id}/cancel`)
      const r = await api.get(`/orders/${id}`)
      setOrder(mapAdminOrder(unwrapData(r.data, null)))
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      alert(err.response?.data?.message ?? 'Không thể hủy đơn hàng')
    } finally {
      setCancelling(false)
    }
  }

  if (!authReady) {
    return <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>Đang tải…</div>
  }
  if (!user) return <Navigate to="/login" replace />

  if (loading) {
    return <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>Đang tải chi tiết đơn…</div>
  }

  if (error || !order) {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#dc2626', marginBottom: 16 }}>{error || 'Không có dữ liệu.'}</p>
        <Link to="/orders" style={{ color: '#3C5C2D', fontWeight: 700 }}>
          ← Về danh sách đơn
        </Link>
      </div>
    )
  }

  const label = ORDER_STATUS_VI[order.status] ?? order.status
  const { bg, color: fg } = statusBadgeColor(order.status)
  const addr = order.shippingAddress
  const created = order.createdAt
    ? new Date(order.createdAt).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' })
    : '—'

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          padding: '8px 0',
          background: 'none',
          border: 'none',
          color: '#3C5C2D',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: 15,
        }}
      >
        <FiArrowLeft /> Quay lại
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 40, color: '#3C5C2D', display: 'flex' }}>
            <FiPackage />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#3C5C2D' }}>{order.orderCode}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#737373' }}>Đặt lúc {created}</p>
          </div>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: 20,
            background: bg,
            color: fg,
          }}
        >
          {label}
        </span>
      </div>

      <div
        style={{
          background: '#fff',
          border: '2px solid #e7e5e4',
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#3C5C2D' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FiMapPin /> Giao hàng
          </span>
        </h2>
        <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{addr?.receiverName}</p>
        <p style={{ margin: '0 0 6px', color: '#525252' }}>{addr?.receiverPhone}</p>
        <p style={{ margin: 0, color: '#525252', lineHeight: 1.6 }}>
          {addr?.addressLine}
          <br />
          {[addr?.ward, addr?.district, addr?.province].filter(Boolean).join(', ')}
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#737373' }}>
          Thanh toán: <strong style={{ color: '#1a1a1a' }}>{formatOrderPayment(order.paymentMethod)}</strong>
        </p>
      </div>

      <div
        style={{
          background: '#fff',
          border: '2px solid #e7e5e4',
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#3C5C2D' }}>Sản phẩm</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(order.items ?? []).map((line, idx) => (
            <div
              key={`${line.productName}-${idx}`}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                paddingBottom: 14,
                borderBottom: idx < (order.items?.length ?? 0) - 1 ? '1px solid #e7e5e4' : 'none',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {line.productImage ? (
                  <img src={line.productImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <FiShoppingBag size={28} color="#a8a29e" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{line.productName}</div>
                <div style={{ fontSize: 13, color: '#737373' }}>
                  {line.quantity} × {line.unitPrice?.toLocaleString()}đ
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#E2A227' }}>{line.subtotal?.toLocaleString()}đ</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
          border: '2px solid #E2A227',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#525252' }}>Tạm tính</span>
          <span style={{ fontWeight: 600 }}>{order.subtotal?.toLocaleString()}đ</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#525252' }}>Giảm giá</span>
          <span style={{ fontWeight: 600 }}>−{order.discount?.toLocaleString()}đ</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: '#525252' }}>Phí vận chuyển</span>
          <span style={{ fontWeight: 600 }}>{(order.shippingFee ?? 0) === 0 ? 'Miễn phí' : `${order.shippingFee?.toLocaleString()}đ`}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '2px solid rgba(226,162,39,0.4)' }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#3C5C2D' }}>Tổng cộng</span>
          <span style={{ fontWeight: 800, fontSize: 22, color: '#E2A227' }}>{order.total?.toLocaleString()}đ</span>
        </div>
      </div>

      {order.status === 'Pending' && (
        <button
          type="button"
          onClick={cancelOrder}
          disabled={cancelling}
          style={{
            padding: '12px 20px',
            background: '#fff',
            border: '2px solid #dc2626',
            color: '#dc2626',
            borderRadius: 12,
            fontWeight: 700,
            cursor: cancelling ? 'not-allowed' : 'pointer',
            opacity: cancelling ? 0.7 : 1,
          }}
        >
          {cancelling ? 'Đang hủy…' : 'Hủy đơn hàng'}
        </button>
      )}

      <p style={{ marginTop: 20, fontSize: 13, color: '#737373' }}>
        <Link to="/orders" style={{ color: '#3C5C2D', fontWeight: 600 }}>
          ← Xem tất cả đơn hàng
        </Link>
      </p>
    </div>
  )
}
