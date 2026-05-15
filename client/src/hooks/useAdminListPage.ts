import { useEffect, useMemo, useState } from 'react'
import {
  ADMIN_LIST_PAGE_SIZE,
  adminListTotalPages,
  sliceAdminPage,
} from '../utils/adminGridHelpers'

/**
 * Phân trang danh sách đã lọc/sắp: reset về trang 1 khi `resetPageDeps` đổi;
 * tự co trang hiện tại nếu tổng số trang giảm.
 */
export function useAdminListPage<T>(items: T[], resetPageDeps: readonly unknown[]) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, resetPageDeps)

  const totalPages = useMemo(() => adminListTotalPages(items.length), [items.length])

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const pagedItems = useMemo(() => sliceAdminPage(items, page), [items, page])

  return {
    page,
    setPage,
    pagedItems,
    totalPages,
    pageSize: ADMIN_LIST_PAGE_SIZE,
    totalItems: items.length,
  }
}
