/** Đồng bộ với Header (badge giỏ hàng). */
export const CART_UPDATED_EVENT = 'cart:updated'

export function dispatchCartUpdated() {
  window.dispatchEvent(new Event(CART_UPDATED_EVENT))
}
