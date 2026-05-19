import type { ReactNode } from 'react'
import type { Column } from './Table'

type Props<T> = {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  renderMobileCard?: (item: T) => ReactNode
}

const MEDIA_COLUMN_KEYS = new Set(['image', 'images', 'thumbnail', 'avatar', 'photo'])
/** Cột nội dung dài — chiếm trọn hàng trong lưới 2 cột */
const FULL_WIDTH_ROW_KEYS = new Set([
  'name',
  'title',
  'description',
  'email',
  'address',
  'note',
  'content',
  'message',
  'subject',
  'customerName',
  'productName',
])

function isMediaColumn(key: string) {
  return MEDIA_COLUMN_KEYS.has(key)
}

function isFullWidthRow(key: string) {
  return FULL_WIDTH_ROW_KEYS.has(key)
}

/** Chia field: cột trái (tên + field chẵn), cột phải (field lẻ) — cả hai căn đầu cột */
function splitIntoColumns<T>(fieldCols: Column<T>[]) {
  const leading = fieldCols.filter((c) => isFullWidthRow(c.key))
  const rest = fieldCols.filter((c) => !isFullWidthRow(c.key))
  const left: Column<T>[] = [...leading]
  const right: Column<T>[] = []
  rest.forEach((col, i) => {
    if (i % 2 === 0) left.push(col)
    else right.push(col)
  })
  return { left, right }
}

function DefaultMobileCard<T>({ item, columns }: { item: T; columns: Column<T>[] }) {
  const actionsCol = columns.find((c) => c.key === 'actions')
  const bodyCols = columns.filter((c) => c.key !== 'actions')
  const imageCol = bodyCols.find((c) => isMediaColumn(c.key))
  const fieldCols = bodyCols.filter((c) => !isMediaColumn(c.key))

  const cellValue = (col: Column<T>) => {
    if (col.render) return col.render(item)
    const raw = (item as Record<string, unknown>)[col.key]
    if (raw === undefined || raw === null || raw === '') return '—'
    return String(raw)
  }

  const renderField = (col: Column<T>) => (
    <div key={col.key} className="admin-mobile-card__row">
      <span className="admin-mobile-card__label">{col.title}</span>
      <div className="admin-mobile-card__value">{cellValue(col)}</div>
    </div>
  )

  const { left, right } = splitIntoColumns(fieldCols)

  return (
    <article className="admin-mobile-card">
      {imageCol && <div className="admin-mobile-card__media">{cellValue(imageCol)}</div>}
      {fieldCols.length > 0 && (
        <div className="admin-mobile-card__body">
          <div className="admin-mobile-card__col">{left.map(renderField)}</div>
          {right.length > 0 && <div className="admin-mobile-card__col">{right.map(renderField)}</div>}
        </div>
      )}
      {actionsCol?.render && (
        <div className="admin-mobile-card__actions">{actionsCol.render(item)}</div>
      )}
    </article>
  )
}

export default function AdminMobileCardList<T>({
  data,
  columns,
  keyExtractor,
  renderMobileCard,
}: Props<T>) {
  return (
    <div className="admin-mobile-list" role="list">
      {data.map((item) => (
        <div key={keyExtractor(item)} role="listitem">
          {renderMobileCard ? (
            <article className="admin-mobile-card admin-mobile-card--custom">
              {renderMobileCard(item)}
            </article>
          ) : (
            <DefaultMobileCard item={item} columns={columns} />
          )}
        </div>
      ))}
    </div>
  )
}

