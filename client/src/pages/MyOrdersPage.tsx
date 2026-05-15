import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FiChevronRight, FiMapPin, FiPackage, FiSearch, FiShoppingBag } from 'react-icons/fi'
import api from '../api/client'
import { mapAdminOrder, unwrapList, type UiAdminOrder } from '../api/mappers'
import { useAuth } from '../features/auth/context/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import { ORDER_STATUS_VI, formatOrderPayment, statusBadgeColor } from '../utils/orderDisplay'

function shippingSummary(s: UiAdminOrder['shippingAddress']): string {
  if (!s) return ''
  const parts = [s.addressLine, s.ward, s.district, s.province].filter((x) => String(x || '').trim())
  const addr = parts.join(', ')
  const head = [s.receiverName, s.receiverPhone].filter((x) => String(x || '').trim()).join(' · ')
  if (head && addr) return `${head} — ${addr}`
  return head || addr || ''
}

function orderMatchesQuery(o: UiAdminOrder, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const statusVi = ORDER_STATUS_VI[o.status] ?? ''
  const paymentVi = formatOrderPayment(o.paymentMethod)
  const ship = shippingSummary(o.shippingAddress).toLowerCase()
  const itemNames = (o.items ?? []).map((i) => String(i.productName ?? '').toLowerCase())
  const fields = [
    o.orderCode,
    o.status,
    statusVi,
    o.paymentMethod,
    paymentVi,
    String(o.total ?? ''),
    o.couponCode,
    o.shippingAddress?.receiverName,
    o.shippingAddress?.receiverPhone,
    o.shippingAddress?.province,
    o.shippingAddress?.district,
    o.shippingAddress?.ward,
    o.shippingAddress?.addressLine,
    ship,
    ...itemNames,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
  return fields.some((f) => f.includes(s))
}

export default function MyOrdersPage() {
  const { user, authReady } = useAuth()
  const [orders, setOrders] = useState<UiAdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const { isMobile } = useResponsive()

  useEffect(() => {
    if (!authReady || !user) return
    setLoading(true)
    api
      .get('/orders/my-orders')
      .then((r) => {
        setOrders(unwrapList(r.data).map(mapAdminOrder))
        setError('')
      })
      .catch(() => setError('Không tải được danh sách đơn hàng.'))
      .finally(() => setLoading(false))
  }, [authReady, user])

  const filtered = useMemo(() => {
    return orders.filter((o) => orderMatchesQuery(o, search))
  }, [orders, search])

  if (!authReady) {
    return <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>Đang tải…</div>
  }
  if (!user) return <Navigate to="/login" replace />

  const hasOrders = orders.length > 0
  const emptyAfterFilter = hasOrders && filtered.length === 0 && search.trim()

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: isMobile ? 18 : 24 }}>
        <span style={{ fontSize: 40, color: '#3C5C2D', display: 'flex', flexShrink: 0 }}>
          <FiPackage />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#3C5C2D' }}>
            Đơn hàng của tôi
          </h1>
          
        </div>
      </div>

      {hasOrders && (
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="orders-search" style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#3C5C2D', fontSize: 14 }}>
            Tìm đơn hàng
          </label>
          <div style={{ position: 'relative', maxWidth: isMobile ? '100%' : 420 }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#3C5C2D',
                display: 'flex',
                pointerEvents: 'none',
              }}
            >
              <FiSearch size={18} />
            </span>
            <input
              id="orders-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mã đơn, SĐT người nhận, tỉnh/thành, tên sản phẩm, trạng thái…"
              autoComplete="off"
              aria-describedby="orders-search-hint"
              style={{
                width: '100%',
                padding: '12px 14px 12px 44px',
                borderRadius: 12,
                border: '2px solid #e7e5e4',
                fontSize: 15,
                background: '#fafaf9',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          
        </div>
      )}

      {hasOrders && !loading && (
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#57534e' }}>
          {search.trim() ? (
            <>
              Hiển thị <strong>{filtered.length}</strong> / {orders.length} đơn khớp từ khóa.
            </>
          ) : (
            <>
              Bạn có <strong>{orders.length}</strong> đơn hàng (mới nhất lên trên).
            </>
          )}
        </p>
      )}

      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}
      {loading && <p style={{ color: '#737373' }}>Đang tải đơn hàng…</p>}

      {!loading && !hasOrders && (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            background: '#fafaf9',
            borderRadius: 16,
            border: '2px dashed #e7e5e4',
          }}
        >
          <p style={{ fontSize: 16, color: '#57534e', marginBottom: 20 }}>Bạn chưa có đơn hàng nào.</p>
          <Link
            to="/products"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
              color: '#fff',
              borderRadius: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Mua sắm ngay
          </Link>
        </div>
      )}

      {!loading && emptyAfterFilter && (
        <div
          style={{
            padding: 28,
            textAlign: 'center',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 14,
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, color: '#92400e', fontWeight: 600 }}>
            Không có đơn nào khớp “{search.trim()}”. Thử từ khóa khác hoặc xóa ô tìm kiếm.
          </p>
        </div>
      )}

      {!loading &&
        filtered.map((o) => {
          const label = ORDER_STATUS_VI[o.status] ?? o.status
          const { bg, color: fg } = statusBadgeColor(o.status)
          const dateStr = o.createdAt
            ? new Date(o.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
            : '—'
          const items = o.items ?? []
          const itemCount = items.length
          const previewNames = items
            .slice(0, 3)
            .map((i) => i.productName)
            .filter(Boolean)
          const more = itemCount > previewNames.length ? ` (+${itemCount - previewNames.length} mặt hàng khác)` : ''
          const productsLine =
            itemCount === 0
              ? 'Chưa có dòng sản phẩm'
              : `${itemCount} mặt hàng: ${previewNames.join(', ')}${more}`
          const shipLine = shippingSummary(o.shippingAddress) || 'Chưa có địa chỉ giao hàng'
          const paymentLabel = formatOrderPayment(o.paymentMethod)

          return (
            <Link
              key={o.id}
              to={`/orders/${o.id}`}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                marginBottom: 16,
              }}
            >
              <article
                style={{
                  padding: isMobile ? 16 : 20,
                  background: '#fff',
                  border: '2px solid #e7e5e4',
                  borderRadius: 14,
                  borderLeft: '4px solid #3C5C2D',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Mã đơn
                    </div>
                    <div style={{ fontWeight: 800, color: '#1a1a1a', fontSize: isMobile ? 17 : 18, marginTop: 2 }}>
                      {o.orderCode}
                    </div>
                    <div style={{ fontSize: 13, color: '#737373', marginTop: 4 }}>Đặt lúc {dateStr}</div>
                  </div>
                  <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#78716c', marginBottom: 4 }}>Tổng thanh toán</div>
                    <div style={{ fontWeight: 800, color: '#E2A227', fontSize: isMobile ? 20 : 22 }}>
                      {o.total?.toLocaleString('vi-VN')}đ
                    </div>
                    {o.discount > 0 && (
                      <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                        Đã giảm {o.discount.toLocaleString('vi-VN')}đ
                        {o.couponCode ? ` · Mã ${o.couponCode}` : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 12,
                    paddingBottom: 12,
                    borderBottom: '1px solid #f5f5f4',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: 20,
                      background: bg,
                      color: fg,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: 13, color: '#44403c' }}>{paymentLabel}</span>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#3C5C2D', flexShrink: 0, marginTop: 2, display: 'flex' }}>
                    <FiShoppingBag />
                  </span>
                  <div style={{ fontSize: 13, color: '#44403c', lineHeight: 1.5 }}>{productsLine}</div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ color: '#3C5C2D', flexShrink: 0, marginTop: 2, display: 'flex' }}>
                    <FiMapPin />
                  </span>
                  <div style={{ fontSize: 13, color: '#57534e', lineHeight: 1.5 }}>{shipLine}</div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 6,
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#3C5C2D',
                  }}
                >
                  Xem chi tiết đơn <FiChevronRight />
                </div>
              </article>
            </Link>
          )
        })}
    </div>
  )
}
