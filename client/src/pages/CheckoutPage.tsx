import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiMapPin,
  FiShoppingBag,
  FiTag,
  FiTruck,
  FiX,
} from 'react-icons/fi'
import { RiQrCodeLine } from 'react-icons/ri'
import { useAuth } from '../features/auth/context/AuthContext'
import api from '../api/client'
import { unwrapData } from '../api/mappers'
import { dispatchCartUpdated } from '../utils/cartEvents'
import { useResponsive } from '../hooks/useResponsive'
import VietnamAddressFields, {
  resolveVietnamAddressNames,
  type VietnamAddressCodes,
} from '../components/VietnamAddressFields'

const CHECKOUT_LINES_KEY = 'ff_checkout_lines_v1'

/** Ảnh mẫu VietQR / chuyển khoản — hiển thị trong popup thanh toán QR giả lập */
const VIETQR_DEMO_IMAGE_URL =
  'https://res.cloudinary.com/dpigoorhc/image/upload/v1778614972/01bab283-c777-447a-b45f-7404918ded8e.png'

const FREE_SHIPPING_SUBTOTAL_MIN = 300_000
const SHIPPING_FEE = 20_000

type ActiveCoupon = {
  code: string
  discountType: string
  discountValue: number
  minOrderValue: number
}

export type CheckoutLine = {
  productId: string
  productName: string
  imageUrl?: string
  price: number
  quantity: number
}

function computeCouponDiscount(subtotal: number, c: ActiveCoupon): number {
  if (subtotal < (c.minOrderValue ?? 0)) return 0
  const raw =
    c.discountType === 'PERCENT' ? (subtotal * c.discountValue) / 100 : c.discountValue
  return Math.min(Math.max(0, raw), subtotal)
}

function normalizeVNPhone(input: string): string {
  let d = input.trim().replace(/[\s.-]/g, '').replace(/\D/g, '')
  if (d.startsWith('84') && d.length >= 10) d = `0${d.slice(2)}`
  return d
}

function isValidVNMobilePhone(digits: string): boolean {
  return /^0[35789]\d{8}$/.test(digits)
}

type ShipFieldErrors = Partial<{
  receiverName: string
  receiverPhone: string
  address: string
  province: string
  district: string
  ward: string
}>

function validateShippingForm(
  receiverName: string,
  receiverPhone: string,
  addressLine: string,
  vn: VietnamAddressCodes
): { ok: boolean; errors: ShipFieldErrors; phoneNormalized: string } {
  const errors: ShipFieldErrors = {}
  if (!receiverName.trim()) {
    errors.receiverName = 'Vui lòng nhập họ tên người nhận.'
  }
  if (!addressLine.trim()) {
    errors.address = 'Vui lòng nhập số nhà, tên đường hoặc địa chỉ chi tiết (ngõ, hẻm…).'
  }
  if (!vn.provinceCode) {
    errors.province = 'Vui lòng chọn tỉnh/thành phố.'
  }
  if (!vn.districtCode) {
    errors.district = 'Vui lòng chọn quận/huyện.'
  }
  if (!vn.wardCode) {
    errors.ward = 'Vui lòng chọn phường/xã.'
  }
  const phoneNorm = normalizeVNPhone(receiverPhone)
  if (!receiverPhone.trim()) {
    errors.receiverPhone = 'Vui lòng nhập số điện thoại người nhận.'
  } else if (!isValidVNMobilePhone(phoneNorm)) {
    errors.receiverPhone =
      'Số điện thoại không hợp lệ. Nhập 10 chữ số (ví dụ 0912345678), hoặc +84912345678.'
  }
  return { ok: Object.keys(errors).length === 0, errors, phoneNormalized: phoneNorm }
}

function parseLines(raw: unknown): CheckoutLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: CheckoutLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    const productId = String(r.productId ?? '')
    const productName = String(r.productName ?? 'Sản phẩm')
    const quantity = Number(r.quantity)
    const price = Number(r.price)
    if (!productId || quantity < 1 || !Number.isFinite(price)) return null
    out.push({
      productId,
      productName,
      imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : undefined,
      price,
      quantity,
    })
  }
  return out
}

export default function CheckoutPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobile } = useResponsive()

  const [lines, setLines] = useState<CheckoutLine[]>([])
  const [checkoutHydrated, setCheckoutHydrated] = useState(false)
  const [addressLine, setAddressLine] = useState('')
  const [vnCodes, setVnCodes] = useState<VietnamAddressCodes>({
    provinceCode: '',
    districtCode: '',
    wardCode: '',
  })
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ShipFieldErrors>({})
  const [paymentMethod, setPaymentMethod] = useState<'CashOnDelivery' | 'BankTransfer'>(
    'CashOnDelivery'
  )
  const [qrPaymentModalOpen, setQrPaymentModalOpen] = useState(false)
  const [activeCoupons, setActiveCoupons] = useState<ActiveCoupon[]>([])
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<ActiveCoupon | null>(null)
  const [couponMsg, setCouponMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const fromNav = parseLines((location.state as { lines?: unknown })?.lines)
    if (fromNav?.length) {
      try {
        sessionStorage.setItem(CHECKOUT_LINES_KEY, JSON.stringify(fromNav))
      } catch {
        /* ignore */
      }
      setLines(fromNav)
      setCheckoutHydrated(true)
      return
    }
    try {
      const raw = sessionStorage.getItem(CHECKOUT_LINES_KEY)
      if (raw) {
        const parsed = parseLines(JSON.parse(raw))
        if (parsed?.length) {
          setLines(parsed)
          setCheckoutHydrated(true)
          return
        }
      }
    } catch {
      /* ignore */
    }
    setLines([])
    setCheckoutHydrated(true)
  }, [location.state])

  useEffect(() => {
    if (!checkoutHydrated) return
    if (!lines.length && user) navigate('/cart', { replace: true })
  }, [checkoutHydrated, lines.length, user, navigate])

  useEffect(() => {
    if (!user) return
    api
      .get('/coupons/active')
      .then((r) => setActiveCoupons(unwrapData<any[]>(r.data, []) as ActiveCoupon[]))
      .catch(() => setActiveCoupons([]))
  }, [user])

  useEffect(() => {
    if (user) {
      setReceiverName(user.name ?? '')
      setReceiverPhone(user.phone ?? '')
    }
  }, [user])

  useEffect(() => {
    if (lines.length === 0) {
      setAppliedCoupon(null)
      setCouponInput('')
      setCouponMsg(null)
    }
  }, [lines.length])

  useEffect(() => {
    if (paymentMethod === 'CashOnDelivery') setQrPaymentModalOpen(false)
  }, [paymentMethod])

  useEffect(() => {
    if (!qrPaymentModalOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) setQrPaymentModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [qrPaymentModalOpen, loading])

  const subtotal = lines.reduce((s, i) => s + i.price * i.quantity, 0)
  const shippingFee = subtotal >= FREE_SHIPPING_SUBTOTAL_MIN ? 0 : SHIPPING_FEE
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0
    return computeCouponDiscount(subtotal, appliedCoupon)
  }, [subtotal, appliedCoupon])
  const orderTotal = subtotal - discountAmount + shippingFee
  const untilFreeShip = Math.max(0, FREE_SHIPPING_SUBTOTAL_MIN - subtotal)
  const showFreeShipHint = shippingFee > 0 && subtotal > 0

  const applyCouponClick = () => {
    setCouponMsg(null)
    const code = couponInput.trim().toUpperCase()
    if (!code) {
      setCouponMsg({ type: 'err', text: 'Vui lòng nhập mã giảm giá.' })
      return
    }
    const c = activeCoupons.find((x) => x.code === code)
    if (!c) {
      setAppliedCoupon(null)
      setCouponMsg({
        type: 'err',
        text: 'Mã không hợp lệ, đã hết hạn, hết lượt dùng hoặc không khả dụng.',
      })
      return
    }
    if (subtotal < c.minOrderValue) {
      setAppliedCoupon(null)
      setCouponMsg({
        type: 'err',
        text: `Đơn cần tối thiểu ${c.minOrderValue.toLocaleString()}đ để dùng mã này (hiện ${subtotal.toLocaleString()}đ).`,
      })
      return
    }
    setAppliedCoupon(c)
    setCouponInput(c.code)
    setCouponMsg({ type: 'ok', text: `Đã áp dụng mã ${c.code}.` })
  }

  const clearCouponClick = () => {
    setAppliedCoupon(null)
    setCouponMsg(null)
    setCouponInput('')
  }

  const finalizePlaceOrder = async (
    phoneNormalized: string,
    options?: { closeQrModalOnSuccess?: boolean }
  ) => {
    if (!user || !lines.length) return
    const disc = appliedCoupon ? computeCouponDiscount(subtotal, appliedCoupon) : 0
    setLoading(true)
    setError('')
    try {
      const { province, district, ward } = resolveVietnamAddressNames(vnCodes)
      const { data } = await api.post('/checkout/place-order', {
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        shippingAddress: {
          receiverName: receiverName.trim(),
          receiverPhone: phoneNormalized,
          province,
          district,
          ward,
          addressLine: addressLine.trim(),
        },
        paymentMethod,
        ...(disc > 0 && appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      })
      try {
        sessionStorage.removeItem(CHECKOUT_LINES_KEY)
      } catch {
        /* ignore */
      }
      if (options?.closeQrModalOnSuccess) setQrPaymentModalOpen(false)
      alert(`Đặt hàng thành công! Mã đơn: ${data?.data?.orderCode ?? ''}`)
      dispatchCartUpdated()
      navigate('/orders')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      const message = err.response?.data?.message ?? 'Có lỗi xảy ra'
      setError(message)
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  const placeOrder = async () => {
    if (!user || !lines.length) return
    const { ok, errors, phoneNormalized } = validateShippingForm(
      receiverName,
      receiverPhone,
      addressLine,
      vnCodes
    )
    setFieldErrors(errors)
    if (!ok) {
      setError('Vui lòng kiểm tra và sửa các trường được đánh dấu.')
      return
    }
    const disc = appliedCoupon ? computeCouponDiscount(subtotal, appliedCoupon) : 0
    if (appliedCoupon && disc <= 0) {
      setError(
        `Tạm tính tối thiểu ${appliedCoupon.minOrderValue.toLocaleString()}đ mới dùng được mã ${appliedCoupon.code}.`
      )
      return
    }
    if (paymentMethod === 'BankTransfer') {
      setQrPaymentModalOpen(true)
      return
    }
    await finalizePlaceOrder(phoneNormalized)
  }

  const confirmSimulatedQrPayment = async () => {
    if (!user || !lines.length) return
    const { ok, errors, phoneNormalized } = validateShippingForm(
      receiverName,
      receiverPhone,
      addressLine,
      vnCodes
    )
    setFieldErrors(errors)
    if (!ok) {
      setError('Vui lòng kiểm tra và sửa các trường được đánh dấu.')
      setQrPaymentModalOpen(false)
      return
    }
    const disc = appliedCoupon ? computeCouponDiscount(subtotal, appliedCoupon) : 0
    if (appliedCoupon && disc <= 0) {
      setError(
        `Tạm tính tối thiểu ${appliedCoupon.minOrderValue.toLocaleString()}đ mới dùng được mã ${appliedCoupon.code}.`
      )
      setQrPaymentModalOpen(false)
      return
    }
    await finalizePlaceOrder(phoneNormalized, { closeQrModalOnSuccess: true })
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
        <p style={{ color: '#737373', marginBottom: 24 }}>Bạn cần đăng nhập để thanh toán</p>
        <Link
          to="/login"
          state={{ from: location.pathname }}
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

  if (!checkoutHydrated) {
    return (
      <div style={{ padding: 24 }}>
        <p>Đang tải…</p>
      </div>
    )
  }

  if (!lines.length) {
    return (
      <div style={{ padding: 24 }}>
        <p>Đang chuyển về giỏ hàng…</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      <Link
        to="/cart"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          color: '#3C5C2D',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <FiArrowLeft /> Quay lại giỏ hàng
      </Link>

      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}

      <h1
        style={{
          marginBottom: isMobile ? 20 : 28,
          fontSize: isMobile ? 22 : 28,
          fontWeight: 700,
          color: '#3C5C2D',
        }}
      >
        Thanh toán
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.1fr', gap: isMobile ? 24 : 32 }}>
        <div
          style={{
            background: '#fff',
            border: '2px solid #e7e5e4',
            borderRadius: 16,
            padding: isMobile ? 16 : 24,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
            height: 'fit-content',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
            Đơn hàng ({lines.length} mặt hàng)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lines.map((l) => (
              <div
                key={l.productId}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  background: '#fafaf9',
                  borderRadius: 12,
                  border: '1px solid #e7e5e4',
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
                  }}
                >
                  {l.imageUrl ? (
                    <img src={l.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3C5C2D',
                      }}
                    >
                      <FiShoppingBag />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={`/products/${l.productId}`}
                    style={{ fontWeight: 600, color: '#1a1a1a', textDecoration: 'none', fontSize: 14 }}
                  >
                    {l.productName}
                  </Link>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#737373' }}>
                    SL: {l.quantity} × {l.price?.toLocaleString()}đ
                  </p>
                </div>
                <div style={{ fontWeight: 700, color: '#E2A227', fontSize: 14, flexShrink: 0 }}>
                  {(l.price * l.quantity).toLocaleString()}đ
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
            padding: isMobile ? 20 : 28,
            borderRadius: 20,
            border: '3px solid #E2A227',
            boxShadow: '0 8px 24px rgba(226, 162, 39, 0.15)',
            height: 'fit-content',
            position: 'sticky',
            top: 100,
          }}
        >
          <h3
            style={{
              margin: '0 0 20px',
              fontSize: 20,
              fontWeight: 700,
              color: '#3C5C2D',
              borderBottom: '2px solid #E2A227',
              paddingBottom: 12,
            }}
          >
            Thông tin người nhận
          </h3>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#3C5C2D' }}>
              Họ tên người nhận <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              value={receiverName}
              onChange={(e) => {
                setReceiverName(e.target.value)
                if (fieldErrors.receiverName) setFieldErrors((f) => ({ ...f, receiverName: undefined }))
                setError('')
              }}
              placeholder="Nhập họ và tên đầy đủ"
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.receiverName)}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: fieldErrors.receiverName ? '2px solid #dc2626' : '2px solid #e7e5e4',
                fontSize: 14,
                outline: 'none',
                marginBottom: fieldErrors.receiverName ? 4 : 10,
                boxSizing: 'border-box',
              }}
            />
            {fieldErrors.receiverName && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#dc2626' }}>{fieldErrors.receiverName}</p>
            )}

            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#3C5C2D' }}>
              Số điện thoại <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={receiverPhone}
              onChange={(e) => {
                setReceiverPhone(e.target.value)
                if (fieldErrors.receiverPhone) setFieldErrors((f) => ({ ...f, receiverPhone: undefined }))
                setError('')
              }}
              placeholder="Ví dụ: 0912345678"
              autoComplete="tel"
              aria-invalid={Boolean(fieldErrors.receiverPhone)}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: fieldErrors.receiverPhone ? '2px solid #dc2626' : '2px solid #e7e5e4',
                fontSize: 14,
                outline: 'none',
                marginBottom: fieldErrors.receiverPhone ? 4 : 6,
                boxSizing: 'border-box',
              }}
            />
            {fieldErrors.receiverPhone && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#dc2626' }}>{fieldErrors.receiverPhone}</p>
            )}

            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#3C5C2D' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FiMapPin /> Địa chỉ giao hàng <span style={{ color: '#dc2626' }}>*</span>
              </span>
            </label>
            <VietnamAddressFields
              value={vnCodes}
              onChange={(next) => {
                setVnCodes(next)
                setFieldErrors((f) => ({
                  ...f,
                  province: undefined,
                  district: undefined,
                  ward: undefined,
                }))
                setError('')
              }}
              errors={{
                province: fieldErrors.province,
                district: fieldErrors.district,
                ward: fieldErrors.ward,
              }}
            />
            <label
              style={{
                display: 'block',
                marginTop: 4,
                marginBottom: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#3C5C2D',
              }}
            >
              Số nhà, đường, ngõ… <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={addressLine}
              onChange={(e) => {
                setAddressLine(e.target.value)
                if (fieldErrors.address) setFieldErrors((f) => ({ ...f, address: undefined }))
                setError('')
              }}
              placeholder="Ví dụ: 12 ngõ 4, phố Trần Hưng Đạo"
              rows={2}
              autoComplete="street-address"
              aria-invalid={Boolean(fieldErrors.address)}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: fieldErrors.address ? '2px solid #dc2626' : '2px solid #e7e5e4',
                fontSize: 14,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                marginBottom: fieldErrors.address ? 4 : 0,
                boxSizing: 'border-box',
              }}
            />
            {fieldErrors.address && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{fieldErrors.address}</p>
            )}
          </div>

          <h3
            style={{
              margin: '0 0 14px',
              fontSize: 18,
              fontWeight: 700,
              color: '#3C5C2D',
              borderBottom: '2px solid #E2A227',
              paddingBottom: 10,
            }}
          >
            Phương thức thanh toán
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                borderRadius: 12,
                border: paymentMethod === 'CashOnDelivery' ? '2px solid #3C5C2D' : '2px solid #e7e5e4',
                background: paymentMethod === 'CashOnDelivery' ? '#f0f9f4' : '#fff',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <input
                type="radio"
                name="checkout-payment"
                checked={paymentMethod === 'CashOnDelivery'}
                onChange={() => setPaymentMethod('CashOnDelivery')}
                style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer', accentColor: '#3C5C2D' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#3C5C2D', display: 'flex' }}>
                    <FiTruck size={20} />
                  </span>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>Thanh toán khi nhận hàng (COD)</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#737373', lineHeight: 1.45 }}>
                  Thanh toán bằng tiền mặt khi shipper giao hàng tận nơi.
                </p>
              </div>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                borderRadius: 12,
                border: paymentMethod === 'BankTransfer' ? '2px solid #3C5C2D' : '2px solid #e7e5e4',
                background: paymentMethod === 'BankTransfer' ? '#f0f9f4' : '#fff',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <input
                type="radio"
                name="checkout-payment"
                checked={paymentMethod === 'BankTransfer'}
                onChange={() => setPaymentMethod('BankTransfer')}
                style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer', accentColor: '#3C5C2D' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#3C5C2D', display: 'flex' }}>
                    <RiQrCodeLine size={22} />
                  </span>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>Thanh toán QR (VietQR)</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#166534',
                      background: '#dcfce7',
                      border: '1px solid #86efac',
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    Giả lập
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#737373', lineHeight: 1.45 }}>
                  Hiển thị mã QR chuyển khoản; sau khi quét và chuyển (hoặc thử nghiệm), nhấn xác nhận để hoàn tất đơn.
                </p>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#3C5C2D' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FiTag /> Mã giảm giá
              </span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }}>
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Nhập mã (vd: FRESH10)"
                maxLength={32}
                style={{
                  flex: '1 1 160px',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '2px solid #e7e5e4',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={applyCouponClick}
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #E2A227 0%, #f0b844 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(226, 162, 39, 0.25)',
                }}
              >
                Áp dụng
              </button>
              {appliedCoupon && (
                <button
                  type="button"
                  onClick={clearCouponClick}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '2px solid #e7e5e4',
                    background: '#fff',
                    color: '#57534e',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Bỏ mã
                </button>
              )}
            </div>
            {couponMsg && (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: couponMsg.type === 'ok' ? '#166534' : '#dc2626' }}>
                {couponMsg.text}
              </p>
            )}
          </div>

          <div
            style={{
              background: '#fff',
              padding: 18,
              borderRadius: 12,
              marginBottom: 18,
              border: '2px solid #e7e5e4',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#737373' }}>Tạm tính:</span>
              <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{subtotal.toLocaleString()}đ</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: '#737373' }}>Giảm giá {appliedCoupon ? `(${appliedCoupon.code})` : ''}:</span>
                <span style={{ fontWeight: 600, color: '#166534' }}>−{discountAmount.toLocaleString()}đ</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#737373' }}>Phí vận chuyển:</span>
              <span style={{ fontWeight: 600, color: shippingFee > 0 ? '#1a1a1a' : '#3C5C2D' }}>
                {shippingFee > 0 ? `${shippingFee.toLocaleString()}đ` : 'Miễn phí'}
              </span>
            </div>
            {showFreeShipHint && untilFreeShip > 0 && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#b45309', lineHeight: 1.4 }}>
                Mua thêm <strong>{untilFreeShip.toLocaleString()}đ</strong> nữa để được miễn phí giao hàng.
              </p>
            )}
            <div
              style={{
                borderTop: '2px solid #e7e5e4',
                paddingTop: 12,
                marginTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: '#3C5C2D' }}>Tổng cộng:</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#E2A227' }}>{orderTotal.toLocaleString()}đ</span>
            </div>
          </div>

          <button
            type="button"
            onClick={placeOrder}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 22px',
              background: loading ? '#d4d4d8' : 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: loading ? 'none' : '0 4px 12px rgba(60, 92, 45, 0.3)',
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FiClock /> Đang xử lý...
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FiCheckCircle /> Đặt hàng
              </span>
            )}
          </button>

          <p style={{ marginTop: 14, fontSize: 12, color: '#737373', textAlign: 'center', lineHeight: 1.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <FiLock /> Thanh toán an toàn và bảo mật
            </span>
          </p>
        </div>
      </div>
    </div>

      {qrPaymentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-qr-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'linear-gradient(165deg, #1f6b42 0%, #145a4a 42%, #0c4a6e 100%)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              background: '#fff',
              borderRadius: 22,
              padding: isMobile ? 18 : 26,
              boxShadow: '0 24px 56px rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <button
              type="button"
              aria-label="Đóng"
              disabled={loading}
              onClick={() => {
                if (!loading) setQrPaymentModalOpen(false)
              }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                background: '#f5f5f4',
                color: '#44403c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              <FiX size={22} />
            </button>

            <h2
              id="checkout-qr-title"
              style={{
                margin: '0 44px 10px 0',
                fontSize: isMobile ? 18 : 20,
                fontWeight: 700,
                color: '#3C5C2D',
                lineHeight: 1.3,
              }}
            >
              Quét mã để chuyển khoản
            </h2>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#57534e', lineHeight: 1.5 }}>
              Giao diện giả lập VietQR. Quét mã hoặc chuyển khoản theo thông tin trên ảnh, sau đó nhấn nút bên dưới để
              xác nhận đã thanh toán và tạo đơn hàng.
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
              Số tiền thanh toán:{' '}
              <span style={{ color: '#E2A227' }}>{orderTotal.toLocaleString()}đ</span>
            </p>

            <div
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid #e7e5e4',
                background: '#fafaf9',
              }}
            >
              <img
                src={VIETQR_DEMO_IMAGE_URL}
                alt="Mã QR chuyển khoản VietQR"
                style={{ width: '100%', height: 'auto', display: 'block', verticalAlign: 'top' }}
              />
            </div>

            <button
              type="button"
              onClick={confirmSimulatedQrPayment}
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '14px 18px',
                border: 'none',
                borderRadius: 12,
                background: loading ? '#d4d4d8' : 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(60, 92, 45, 0.35)',
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <FiClock /> Đang xử lý…
                </span>
              ) : (
                'Xác nhận đã thanh toán'
              )}
            </button>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#78716c', textAlign: 'center', lineHeight: 1.45 }}>
              Nút này mô phỏng xác nhận từ ngân hàng sau khi nhận được tiền — đơn sẽ được ghi nhận thanh toán QR (giả
              lập).
            </p>
          </div>
        </div>
      )}
    </>
  )
}
