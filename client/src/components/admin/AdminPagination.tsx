import type { CSSProperties, ReactNode } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { adminListTotalPages } from '../../utils/adminGridHelpers'

type Props = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
}

/** Danh sách số trang + 'ellipsis' (…) giữa các khúc xa nhau. */
function buildPageItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 1) return [1]
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const set = new Set<number>()
  set.add(1)
  set.add(total)
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) set.add(i)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out: Array<number | 'ellipsis'> = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }
  return out
}

const btnBase: CSSProperties = {
  minWidth: 42,
  height: 42,
  padding: '0 10px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s',
}

export default function AdminPagination({ page, pageSize, totalItems, onPageChange }: Props) {
  if (totalItems === 0) return null

  const totalPages = adminListTotalPages(totalItems, pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)
  const canPrev = page > 1
  const canNext = page < totalPages
  const pageItems = buildPageItems(page, totalPages)

  const inactiveCell: CSSProperties = {
    ...btnBase,
    background: 'var(--surface)',
    color: 'var(--brand-green)',
    border: '2px solid var(--border-soft)',
  }

  const navBtn = (disabled: boolean, onClick: () => void, children: ReactNode, ariaLabel: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        ...inactiveCell,
        width: 42,
        minWidth: 42,
        padding: 0,
        color: disabled ? 'var(--text-secondary)' : 'var(--brand-green)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: '1px solid var(--border-soft)',
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        rowGap: 10,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--text-secondary)',
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        Dòng {from}–{to} trong {totalItems} · {pageSize} dòng/trang
      </p>
      <div
        className="admin-pagination-nav"
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          background: 'var(--surface-soft)',
          borderRadius: 'var(--radius-md)',
          border: '2px solid var(--border-soft)',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
        }}
      >
        {navBtn(
          !canPrev,
          () => canPrev && onPageChange(page - 1),
          <FiChevronLeft size={20} strokeWidth={2.5} />,
          'Trang trước'
        )}
        {pageItems.map((item, idx) =>
          item === 'ellipsis' ? (
            <span
              key={`e-${idx}`}
              style={{
                ...btnBase,
                minWidth: 36,
                width: 36,
                padding: 0,
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'default',
                fontWeight: 700,
                border: '2px solid transparent',
              }}
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => item !== page && onPageChange(item)}
              style={{
                ...btnBase,
                minWidth: 42,
                border: '2px solid',
                ...(item === page
                  ? {
                      background: 'linear-gradient(135deg, var(--brand-green) 0%, var(--brand-green-2) 100%)',
                      color: '#fff',
                      borderColor: 'var(--brand-green)',
                      boxShadow: 'inset 0 -2px 0 0 var(--brand-gold)',
                      cursor: 'default',
                    }
                  : {
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border-soft)',
                      cursor: 'pointer',
                    }),
              }}
            >
              {item}
            </button>
          )
        )}
        {navBtn(
          !canNext,
          () => canNext && onPageChange(page + 1),
          <FiChevronRight size={20} strokeWidth={2.5} />,
          'Trang sau'
        )}
      </div>
    </div>
  )
}
