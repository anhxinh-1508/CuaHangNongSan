import { ReactNode, CSSProperties } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  const containerStyle: CSSProperties = {
    marginBottom: 32,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
  }

  const leftStyle: CSSProperties = {
    flex: 1,
    minWidth: 250,
  }

  const titleStyle: CSSProperties = {
    margin: '0 0 8px',
    fontSize: 32,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: 'var(--brand-green)',
  }

  const subtitleStyle: CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: 15,
    margin: 0,
  }

  return (
    <div style={containerStyle}>
      <div style={leftStyle}>
        <h1 style={titleStyle}>
          {icon && <span style={{ fontSize: 36, display: 'flex' }}>{icon}</span>}
          {title}
        </h1>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
