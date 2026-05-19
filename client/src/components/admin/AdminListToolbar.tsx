import type { CSSProperties, ReactNode } from 'react'
import Input from './Input'

type Props = {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  searchLabel?: string
  filteredCount: number
  totalCount: number
  children?: ReactNode
  style?: CSSProperties
}

export default function AdminListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Gõ để lọc danh sách…',
  searchLabel = 'Tìm kiếm',
  filteredCount,
  totalCount,
  children,
  style,
}: Props) {
  return (
    <div
      className="admin-list-toolbar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
        marginBottom: 16,
        ...style,
      }}
    >
      <div className="admin-list-toolbar-search" style={{ flex: '1 1 220px', minWidth: 0 }}>
        <Input
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          containerStyle={{ marginBottom: 0 }}
        />
      </div>
      {children}
      <span className="admin-list-toolbar-count" style={{ fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 10, width: '100%', boxSizing: 'border-box' }}>
        Hiển thị: {filteredCount} / {totalCount}
      </span>
    </div>
  )
}
