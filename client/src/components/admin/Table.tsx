import { ReactNode, CSSProperties } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { useResponsive } from '../../hooks/useResponsive'
import AdminMobileCardList from './AdminMobileCardList'

export interface Column<T> {
  key: string
  title: string
  render?: (item: T) => ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
  /** Bấm tiêu đề cột để đổi tăng dần / giảm dần */
  sortable?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  emptyText?: string
  loading?: boolean
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc'
  onSortColumn?: (columnKey: string) => void
  /** Tuỳ chỉnh thẻ trên mobile; mặc định sinh từ columns */
  renderMobileCard?: (item: T) => ReactNode
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyText = 'Không có dữ liệu',
  loading = false,
  sortColumn = null,
  sortDirection = 'asc',
  onSortColumn,
  renderMobileCard,
}: TableProps<T>) {
  const { windowWidth } = useResponsive()
  /** Mobile + tablet: danh sách thẻ cuộn dọc thay cho bảng */
  const useCardList = windowWidth < 1024

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  }

  const thStyle: CSSProperties = {
    background: 'linear-gradient(135deg, var(--brand-green) 0%, var(--brand-green-2) 100%)',
    color: '#fff',
    padding: '12px 14px',
    fontWeight: 700,
    fontSize: 14,
    textAlign: 'left',
    borderBottom: '2px solid var(--brand-gold)',
  }

  const tdStyle: CSSProperties = {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-soft)',
    fontSize: 14,
    color: 'var(--text-primary)',
  }

  const containerStyle: CSSProperties = {
    display: 'block',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid var(--border-soft)',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
        Đang tải...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 40,
          color: 'var(--text-secondary)',
          background: '#fff',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid var(--border-soft)',
        }}
      >
        {emptyText}
      </div>
    )
  }

  if (useCardList) {
    return (
      <AdminMobileCardList
        data={data}
        columns={columns}
        keyExtractor={keyExtractor}
        renderMobileCard={renderMobileCard}
      />
    )
  }

  return (
    <div className="admin-table-desktop-wrap">
      <div className="admin-table-container table-scroll" style={containerStyle}>
        <table className="admin-table" style={tableStyle}>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sortColumn === col.key
                const sortable = Boolean(col.sortable && onSortColumn)
                return (
                  <th
                    key={col.key}
                    style={{
                      ...thStyle,
                      width: col.width,
                      textAlign: col.align || 'left',
                      userSelect: 'none',
                    }}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortColumn!(col.key)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'inherit',
                          font: 'inherit',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: 0,
                          margin: 0,
                          textAlign: col.align || 'left',
                        }}
                      >
                        <span>{col.title}</span>
                        {active ? (
                          sortDirection === 'asc' ? (
                            <FiChevronUp size={18} aria-hidden />
                          ) : (
                            <FiChevronDown size={18} aria-hidden />
                          )
                        ) : (
                          <span style={{ opacity: 0.45, display: 'inline-flex' }} aria-hidden>
                            <FiChevronUp size={14} style={{ marginBottom: -8 }} />
                            <FiChevronDown size={14} style={{ marginLeft: -10 }} />
                          </span>
                        )}
                      </button>
                    ) : (
                      col.title
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={keyExtractor(item)} style={{ transition: 'background 0.2s' }}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      ...tdStyle,
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
