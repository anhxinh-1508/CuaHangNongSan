import { ReactNode, CSSProperties } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

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
}: TableProps<T>) {
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
    padding: '16px 20px',
    fontWeight: 700,
    fontSize: 14,
    textAlign: 'left',
    borderBottom: '2px solid var(--brand-gold)',
  }

  const tdStyle: CSSProperties = {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-soft)',
    fontSize: 14,
    color: 'var(--text-primary)',
  }

  const containerStyle: CSSProperties = {
    overflowX: 'auto',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid var(--border-soft)',
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
      <div style={{ 
        textAlign: 'center', 
        padding: 40, 
        color: 'var(--text-secondary)',
        background: '#fff',
        borderRadius: 'var(--radius-lg)',
        border: '2px solid var(--border-soft)',
      }}>
        {emptyText}
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <table style={tableStyle}>
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
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
