export type ApiEnvelope<T> = {
  data?: T
  message?: string
  pagination?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

export type UiProduct = {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  imageUrl?: string
  /** Tất cả URL ảnh (từ Cloudinary images[] hoặc fallback imageUrl) */
  imageUrls?: string[]
  stock?: number
  useTags?: string[]
}

export type UiCategory = {
  id: string
  name: string
  slug: string
}

export type UiBanner = {
  id: string
  imageUrl: string
  linkUrl?: string
  productId?: string
}

export type UiUser = {
  id: string
  name: string
  email: string
  role: string
  phone?: string
}

export type UiDashboardTopProduct = {
  id: string
  name: string
  soldCount: number
  revenue: number
}

export type UiDashboardStats = {
  totalRevenue: number
  totalOrders: number
  cancelRate: number
  nearExpiryCount: number
  unresolvedContacts: number
  topProducts: UiDashboardTopProduct[]
}

export type UiReportDayRevenue = {
  date: string
  revenue: number
  netSales: number
  cogs: number
  grossProfit: number
}

export type UiReportOrdersDay = { date: string; count: number }

export type UiReportStatusRow = { status: string; count: number }

export type UiReportSummary = {
  totalRevenue: number
  totalNetSales: number
  totalCogs: number
  grossProfit: number
  totalOrders: number
  avgOrderValue: number
  cancelRate: number
  cancelledCount: number
  deliveredCount: number
}

export type UiReportTopProduct = {
  name: string
  quantity: number
  revenue: number
  importCost: number
  grossProfit: number
}

export type UiReportCategoryRow = { category: string; revenue: number }

export type UiReportInventorySummary = {
  totalBatches: number
  activeBatches: number
  nearExpiryBatches: number
  expiredBatches: number
  outOfStockBatches: number
  disabledBatches: number
  totalStockValue: number
  /** Vốn nhập × SL còn, lô sắp hết hạn (chưa tắt) — minh họa rủi ro HSD. */
  nearExpiryStockValueEstimate: number
  /** Vốn nhập × SL còn, lô quá hạn (chưa tắt) — nếu hủy bỏ gần với lỗ vốn; chưa trừ vào ô lãi kỳ. */
  expiredStockValueEstimate: number
}

export type UiReportLowStock = { name: string; stock: number }

export type UiReportCustomerStats = {
  totalCustomers: number
  newCustomers: number
}

export type UiReportCouponStats = {
  totalCoupons: number
  totalUsed: number
  activeCoupons: number
}

export type UiAdminReports = {
  range: string
  revenueTimeline: UiReportDayRevenue[]
  ordersTimeline: UiReportOrdersDay[]
  ordersByStatus: UiReportStatusRow[]
  summary: UiReportSummary
  topProducts: UiReportTopProduct[]
  revenueByCategory: UiReportCategoryRow[]
  inventorySummary: UiReportInventorySummary
  lowStockProducts: UiReportLowStock[]
  customerStats: UiReportCustomerStats
  couponStats: UiReportCouponStats
}

export type UiAdminProduct = {
  id: string
  name: string
  slug: string
  description: string
  categoryId: string
  categoryName?: string
  images: Array<{ secure_url: string; public_id: string }>
  supplier: string
  certifications: string[]
  unit: string
  price: number
  salePrice: number | null
  ratingAvg: number
  soldCount: number
  isActive: boolean
  availableStock?: number
  createdAt?: string
  updatedAt?: string
}

export type UiAdminBatch = {
  id: string
  productId: string
  productName?: string
  batchCode: string
  harvestDate: string
  packingDate: string
  expiryDate: string
  quantityInStock: number
  importPrice: number
  status: string
  isDisabled: boolean
  notes: string
  createdAt?: string
  updatedAt?: string
}

export type UiAdminCategory = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type UiAdminBanner = {
  id: string
  title: string
  image: { secure_url: string; public_id: string } | null
  link: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type UiAdminCoupon = {
  id: string
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  minOrderValue: number
  startAt: string
  endAt: string
  usageLimit: number
  perUserLimit: number
  usedCount: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type UiAdminOrder = {
  id: string
  orderCode: string
  userId?: string
  userName?: string
  userEmail?: string
  guestInfo?: {
    name: string
    email: string
    phone: string
  }
  shippingAddress: {
    receiverName: string
    receiverPhone: string
    province: string
    district: string
    ward: string
    addressLine: string
    note?: string
  }
  note: string
  receivingTimeSlot: string
  paymentMethod: string
  status: string
  items: Array<{
    productId?: string
    productName: string
    productImage: string
    unit: string
    supplier: string
    unitPrice: number
    quantity: number
    subtotal: number
    batchCode?: string
  }>
  subtotal: number
  discount: number
  shippingFee: number
  total: number
  couponCode?: string
  createdAt?: string
  updatedAt?: string
}

export type UiAdminCustomer = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  isVerified: boolean
  createdAt?: string
  updatedAt?: string
}

export type UiAdminContact = {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: string
  internalNotes: string
  createdAt?: string
  updatedAt?: string
}

export const unwrapData = <T>(payload: ApiEnvelope<T> | undefined, fallback: T): T => {
  return (payload?.data ?? fallback) as T
}

/** Nhiều endpoint admin trả `{ data: T[] }` (mảng trực tiếp), không phải `{ data: { products: T[] } }`. */
export const unwrapList = <T>(payload: ApiEnvelope<unknown> | undefined): T[] => {
  const raw = payload?.data
  if (Array.isArray(raw)) return raw as T[]
  return []
}

export const mapUser = (raw: any): UiUser => ({
  id: raw?._id ?? raw?.id ?? '',
  name: raw?.name ?? '',
  email: raw?.email ?? '',
  role: raw?.role ?? 'Customer',
  phone: raw?.phone ?? '',
})

export const mapProduct = (raw: any): UiProduct => {
  const fromImages = Array.isArray(raw?.images)
    ? raw.images.map((img: any) => img?.secure_url).filter(Boolean)
    : []
  const imageUrls =
    fromImages.length > 0 ? fromImages : raw?.imageUrl ? [String(raw.imageUrl)] : []
  return {
    id: raw?._id ?? raw?.id ?? '',
    name: raw?.name ?? '',
    slug: raw?.slug ?? '',
    description: raw?.description ?? '',
    price: raw?.salePrice ?? raw?.price ?? 0,
    imageUrl: imageUrls[0],
    imageUrls,
    stock: raw?.availableStock ?? raw?.stock ?? 0,
    useTags: raw?.certifications ?? [],
  }
}

export const mapCategory = (raw: any): UiCategory => ({
  id: raw?._id ?? raw?.id ?? '',
  name: raw?.name ?? '',
  slug: raw?.slug ?? '',
})

export const mapBanner = (raw: any): UiBanner => ({
  id: raw?._id ?? raw?.id ?? '',
  imageUrl: raw?.image?.secure_url ?? raw?.imageUrl ?? '',
  linkUrl: raw?.link ?? raw?.linkUrl,
  productId: raw?.productId,
})

export const mapDashboardStats = (raw: any): UiDashboardStats => ({
  totalRevenue: raw?.totalRevenue ?? 0,
  totalOrders: raw?.totalOrders ?? 0,
  cancelRate: raw?.cancelRate ?? 0,
  nearExpiryCount: raw?.nearExpiryCount ?? 0,
  unresolvedContacts: raw?.unresolvedContacts ?? 0,
  topProducts: Array.isArray(raw?.topProducts)
    ? raw.topProducts.map((p: any) => ({
        id: String(p?._id ?? p?.id ?? ''),
        name: String(p?.name ?? '—'),
        soldCount: Number(p?.soldCount) || 0,
        revenue: Number(p?.revenue) || 0,
      }))
    : [],
})

const n = (v: unknown, d = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v)) || d

export const mapAdminReports = (raw: any): UiAdminReports => ({
  range: String(raw?.range ?? '30d'),
  revenueTimeline: Array.isArray(raw?.revenueTimeline)
    ? raw.revenueTimeline.map((row: any) => ({
        date: String(row?.date ?? ''),
        revenue: n(row?.revenue),
        netSales: n(row?.netSales),
        cogs: n(row?.cogs),
        grossProfit: n(row?.grossProfit),
      }))
    : [],
  ordersTimeline: Array.isArray(raw?.ordersTimeline)
    ? raw.ordersTimeline.map((row: any) => ({
        date: String(row?.date ?? ''),
        count: n(row?.count),
      }))
    : [],
  ordersByStatus: Array.isArray(raw?.ordersByStatus)
    ? raw.ordersByStatus.map((row: any) => ({
        status: String(row?.status ?? ''),
        count: n(row?.count),
      }))
    : [],
  summary: {
    totalRevenue: n(raw?.summary?.totalRevenue),
    totalNetSales: n(raw?.summary?.totalNetSales),
    totalCogs: n(raw?.summary?.totalCogs),
    grossProfit: n(raw?.summary?.grossProfit),
    totalOrders: n(raw?.summary?.totalOrders),
    avgOrderValue: n(raw?.summary?.avgOrderValue),
    cancelRate: n(raw?.summary?.cancelRate),
    cancelledCount: n(raw?.summary?.cancelledCount),
    deliveredCount: n(raw?.summary?.deliveredCount),
  },
  topProducts: Array.isArray(raw?.topProducts)
    ? raw.topProducts.map((p: any) => ({
        name: String(p?.name ?? '—'),
        quantity: n(p?.quantity),
        revenue: n(p?.revenue),
        importCost: n(p?.importCost),
        grossProfit: n(p?.grossProfit),
      }))
    : [],
  revenueByCategory: Array.isArray(raw?.revenueByCategory)
    ? raw.revenueByCategory.map((row: any) => ({
        category: String(row?.category ?? ''),
        revenue: n(row?.revenue),
      }))
    : [],
  inventorySummary: {
    totalBatches: n(raw?.inventorySummary?.totalBatches),
    activeBatches: n(raw?.inventorySummary?.activeBatches),
    nearExpiryBatches: n(raw?.inventorySummary?.nearExpiryBatches),
    expiredBatches: n(raw?.inventorySummary?.expiredBatches),
    outOfStockBatches: n(raw?.inventorySummary?.outOfStockBatches),
    disabledBatches: n(raw?.inventorySummary?.disabledBatches),
    totalStockValue: n(raw?.inventorySummary?.totalStockValue),
    nearExpiryStockValueEstimate: n(raw?.inventorySummary?.nearExpiryStockValueEstimate),
    expiredStockValueEstimate: n(raw?.inventorySummary?.expiredStockValueEstimate),
  },
  lowStockProducts: Array.isArray(raw?.lowStockProducts)
    ? raw.lowStockProducts.map((p: any) => ({
        name: String(p?.name ?? '—'),
        stock: n(p?.stock),
      }))
    : [],
  customerStats: {
    totalCustomers: n(raw?.customerStats?.totalCustomers),
    newCustomers: n(raw?.customerStats?.newCustomers),
  },
  couponStats: {
    totalCoupons: n(raw?.couponStats?.totalCoupons),
    totalUsed: n(raw?.couponStats?.totalUsed),
    activeCoupons: n(raw?.couponStats?.activeCoupons),
  },
})

export const mapAdminProduct = (raw: any): UiAdminProduct => ({
  id: raw?._id ?? raw?.id ?? '',
  name: raw?.name ?? '',
  slug: raw?.slug ?? '',
  description: raw?.description ?? '',
  categoryId: raw?.categoryId?._id ?? raw?.categoryId ?? '',
  categoryName: raw?.categoryId?.name ?? raw?.categoryName,
  images: raw?.images ?? [],
  supplier: raw?.supplier ?? '',
  certifications: raw?.certifications ?? [],
  unit: raw?.unit ?? '',
  price: raw?.price ?? 0,
  salePrice: raw?.salePrice ?? null,
  ratingAvg: raw?.ratingAvg ?? 0,
  soldCount: raw?.soldCount ?? 0,
  isActive: raw?.isActive ?? true,
  availableStock: raw?.availableStock ?? 0,
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})

export const mapAdminBatch = (raw: any): UiAdminBatch => ({
  id: raw?._id ?? raw?.id ?? '',
  productId: raw?.productId?._id ?? raw?.productId ?? '',
  productName: raw?.productId?.name ?? raw?.productName,
  batchCode: raw?.batchCode ?? '',
  harvestDate: raw?.harvestDate ?? '',
  packingDate: raw?.packingDate ?? '',
  expiryDate: raw?.expiryDate ?? '',
  quantityInStock: raw?.quantityInStock ?? 0,
  importPrice: raw?.importPrice ?? 0,
  status: raw?.status ?? 'Active',
  isDisabled: raw?.isDisabled ?? false,
  notes: raw?.notes ?? '',
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})

export const mapAdminCategory = (raw: any): UiAdminCategory => ({
  id: raw?._id ?? raw?.id ?? '',
  name: raw?.name ?? '',
  slug: raw?.slug ?? '',
  isActive: raw?.isActive ?? true,
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})

export const mapAdminBanner = (raw: any): UiAdminBanner => ({
  id: raw?._id ?? raw?.id ?? '',
  title: raw?.title ?? '',
  image: raw?.image ?? null,
  link: raw?.link ?? '',
  isActive: raw?.isActive ?? true,
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})

export const mapAdminCoupon = (raw: any): UiAdminCoupon => ({
  id: raw?._id ?? raw?.id ?? '',
  code: raw?.code ?? '',
  discountType: raw?.discountType ?? 'PERCENT',
  discountValue: raw?.discountValue ?? 0,
  minOrderValue: raw?.minOrderValue ?? 0,
  startAt: raw?.startAt ?? '',
  endAt: raw?.endAt ?? '',
  usageLimit: raw?.usageLimit ?? 100,
  perUserLimit: raw?.perUserLimit ?? 2,
  usedCount: raw?.usedCount ?? 0,
  isActive: raw?.isActive ?? true,
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})

export const mapAdminOrder = (raw: any): UiAdminOrder => ({
  id: raw?._id ?? raw?.id ?? '',
  orderCode: raw?.orderCode ?? '',
  userId: raw?.userId?._id ?? raw?.userId,
  userName: raw?.userId?.name ?? raw?.guestInfo?.name,
  userEmail: raw?.userId?.email ?? raw?.guestInfo?.email,
  guestInfo: raw?.guestInfo,
  shippingAddress: raw?.shippingAddress ?? {},
  note: raw?.note ?? '',
  receivingTimeSlot: raw?.receivingTimeSlot ?? '',
  paymentMethod: raw?.paymentMethod ?? 'CashOnDelivery',
  status: raw?.status ?? 'Pending',
  items: raw?.items ?? [],
  subtotal: raw?.subtotal ?? 0,
  discount: raw?.discount ?? 0,
  shippingFee: raw?.shippingFee ?? 0,
  total: raw?.total ?? 0,
  couponCode: raw?.couponCode,
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})

export const mapAdminCustomer = (raw: any): UiAdminCustomer => ({
  id: raw?._id ?? raw?.id ?? '',
  name: raw?.name ?? '',
  email: raw?.email ?? '',
  phone: raw?.phone ?? '',
  role: raw?.role ?? 'Customer',
  isVerified: raw?.isVerified ?? false,
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})

export const mapAdminContact = (raw: any): UiAdminContact => ({
  id: raw?._id ?? raw?.id ?? '',
  name: raw?.name ?? '',
  email: raw?.email ?? '',
  subject: raw?.subject ?? '',
  message: raw?.message ?? '',
  status: raw?.status ?? 'Unread',
  internalNotes: raw?.internalNotes ?? '',
  createdAt: raw?.createdAt,
  updatedAt: raw?.updatedAt,
})
