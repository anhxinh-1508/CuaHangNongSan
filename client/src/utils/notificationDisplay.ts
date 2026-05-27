import type { NotificationType } from '../api/notifications'

const TYPE_LABELS: Record<NotificationType, string> = {
  ORDER_STATUS: 'Đơn hàng',
  NEW_ORDER: 'Đơn mới',
  BATCH_NEAR_EXPIRY: 'Lô hàng',
  BATCH_EXPIRED: 'Lô hàng',
  COUPON_NEAR_EXPIRY: 'Voucher',
  COUPON_EXPIRED: 'Voucher',
  NEW_CONTACT: 'Liên hệ',
}

export function notificationTypeLabel(type: NotificationType): string {
  return TYPE_LABELS[type] ?? 'Thông báo'
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const now = Date.now()
  const diff = now - date.getTime()
  if (diff < 60_000) return 'Vừa xong'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} ngày trước`

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
