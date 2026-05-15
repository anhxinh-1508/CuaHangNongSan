/** Hiển thị tiếng Việt — khớp enum backend Order.status */
export const ORDER_STATUS_VI: Record<string, string> = {
  Pending: 'Chờ xác nhận',
  Confirmed: 'Đã xác nhận',
  Packing: 'Đang đóng gói',
  Shipping: 'Đang giao hàng',
  Delivered: 'Đã giao',
  DeliveryFailed: 'Giao không thành công',
  RetryDelivery: 'Giao lại',
  Cancelled: 'Đã hủy',
}

const PAYMENT_VI: Record<string, string> = {
  CashOnDelivery: 'Thanh toán khi nhận hàng (COD)',
  BankTransfer: 'Thanh toán QR / VietQR (chuyển khoản)',
  CreditCard: 'Thẻ',
  Ewallet: 'Ví điện tử',
}

export function formatOrderPayment(code: string): string {
  return PAYMENT_VI[code] ?? code
}

export function statusBadgeColor(status: string): { bg: string; color: string } {
  switch (status) {
    case 'Delivered':
      return { bg: '#dcfce7', color: '#166534' }
    case 'Cancelled':
      return { bg: '#fee2e2', color: '#991b1b' }
    case 'Pending':
      return { bg: '#fef9c3', color: '#854d0e' }
    case 'Shipping':
    case 'Packing':
    case 'Confirmed':
      return { bg: '#e0f2fe', color: '#0369a1' }
    default:
      return { bg: '#f5f5f4', color: '#57534e' }
  }
}
