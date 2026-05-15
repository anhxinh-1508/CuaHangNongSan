import { ReactNode, CSSProperties } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default'
  style?: CSSProperties
}

export default function Badge({ children, variant = 'default', style = {} }: BadgeProps) {
  const variants = {
    success: {
      background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
      color: '#166534',
      border: '2px solid #22c55e',
    },
    warning: {
      background: 'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)',
      color: '#854d0e',
      border: '2px solid #eab308',
    },
    danger: {
      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      color: '#991b1b',
      border: '2px solid #ef4444',
    },
    info: {
      background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
      color: '#1e40af',
      border: '2px solid #3b82f6',
    },
    default: {
      background: 'linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)',
      color: '#44403c',
      border: '2px solid #a8a29e',
    }
  }

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    ...variants[variant],
    ...style
  }

  return <span style={badgeStyle}>{children}</span>
}
