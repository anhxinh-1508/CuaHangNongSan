import api from './client'

export type NotificationType =
  | 'ORDER_STATUS'
  | 'NEW_ORDER'
  | 'BATCH_NEAR_EXPIRY'
  | 'BATCH_EXPIRED'
  | 'COUPON_NEAR_EXPIRY'
  | 'COUPON_EXPIRED'
  | 'NEW_CONTACT'

export type UiNotification = {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string
  isRead: boolean
  createdAt: string
  meta?: Record<string, unknown>
}

export type NotificationsResponse = {
  data: UiNotification[]
  unreadCount: number
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export function mapNotification(raw: Record<string, unknown>): UiNotification {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    type: (raw.type as NotificationType) ?? 'ORDER_STATUS',
    title: String(raw.title ?? ''),
    message: String(raw.message ?? ''),
    link: String(raw.link ?? ''),
    isRead: Boolean(raw.isRead),
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    meta: (raw.meta as Record<string, unknown>) ?? {},
  }
}

export async function fetchNotifications(page = 1, limit = 20): Promise<NotificationsResponse> {
  const { data } = await api.get('/notifications', { params: { page, limit } })
  const list = Array.isArray(data?.data) ? data.data : []
  return {
    data: list.map((row: Record<string, unknown>) => mapNotification(row)),
    unreadCount: Number(data?.unreadCount ?? 0),
    pagination: data?.pagination ?? { page, limit, total: list.length, totalPages: 1 },
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all')
}
