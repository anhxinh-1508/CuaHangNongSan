import { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  title?: string
  actions?: ReactNode
  style?: CSSProperties
  noPadding?: boolean
}

export default function Card({ children, title, actions, style = {}, noPadding = false }: CardProps) {
  const cardStyle: CSSProperties = {
    background: '#fff',
    border: '2px solid var(--border-soft)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'clip',
    overflowY: 'visible',
    boxSizing: 'border-box',
    ...style
  }

  const headerStyle: CSSProperties = {
    padding: '20px 24px',
    borderBottom: '2px solid var(--border-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const bodyStyle: CSSProperties = {
    padding: noPadding ? 0 : '24px',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  }

  return (
    <div className="admin-card" style={cardStyle}>
      {(title || actions) && (
        <div style={headerStyle}>
          {title && (
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--brand-green)' }}>
              {title}
            </h3>
          )}
          {actions && (
            <div style={{ display: 'flex', gap: 8 }}>
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="admin-card-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  )
}
