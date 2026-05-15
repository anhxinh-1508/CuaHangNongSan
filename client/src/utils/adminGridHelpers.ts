/** Chuỗi tìm kiếm: khớp nếu rỗng; không phân biệt hoa thường. */
export function textMatches(query: string, ...parts: (string | number | boolean | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const blob = parts.map((p) => String(p ?? '')).join(' ').toLowerCase()
  return blob.includes(q)
}

/** Cột ngày / số: mặc định giảm dần (mới nhất trước); chữ: tăng dần. */
export function defaultSortDirection(sortKey: string): 'asc' | 'desc' {
  const dateKeys = new Set([
    'createdAt',
    'updatedAt',
    'expiryDate',
    'harvestDate',
    'packingDate',
    'startAt',
    'endAt',
  ])
  const numberKeys = new Set([
    'total',
    'subtotal',
    'importPrice',
    'price',
    'quantityInStock',
    'availableStock',
    'soldCount',
    'usedCount',
    'minOrderValue',
    'discountValue',
  ])
  if (dateKeys.has(sortKey) || numberKeys.has(sortKey)) return 'desc'
  return 'asc'
}

export function sortRows<T>(
  rows: T[],
  sortKey: string,
  sortDir: 'asc' | 'desc',
  accessors: Record<string, (row: T) => number | string>
): T[] {
  const acc = accessors[sortKey]
  if (!acc) return [...rows]
  const dir = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = acc(a)
    const vb = acc(b)
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va === vb) return 0
      return va < vb ? -dir : dir
    }
    const sa = String(va).toLowerCase()
    const sb = String(vb).toLowerCase()
    if (sa === sb) return 0
    return sa < sb ? -dir : dir
  })
}

export function timeOrZero(iso?: string | null): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Số dòng tối đa mỗi trang (danh sách admin). */
export const ADMIN_LIST_PAGE_SIZE = 20

export function adminListTotalPages(totalItems: number, pageSize = ADMIN_LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

export function sliceAdminPage<T>(items: T[], page: number, pageSize = ADMIN_LIST_PAGE_SIZE): T[] {
  const start = (Math.max(1, page) - 1) * pageSize
  return items.slice(start, start + pageSize)
}
