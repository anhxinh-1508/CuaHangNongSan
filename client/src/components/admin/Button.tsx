import { ReactNode, CSSProperties } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement> | (() => void | Promise<void>)
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  icon?: ReactNode
  style?: CSSProperties
  className?: string
}

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false, 
  type = 'button',
  icon,
  style = {},
  className = ''
}: ButtonProps) {
  const baseStyle: CSSProperties = {
    padding: '12px 24px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    fontWeight: 600,
    fontSize: 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
    opacity: disabled ? 0.5 : 1,
    ...style
  }

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, var(--brand-green) 0%, var(--brand-green-2) 100%)',
      color: '#fff',
      boxShadow: 'var(--shadow-brand)',
    },
    secondary: {
      background: '#fff',
      color: 'var(--brand-green)',
      border: '2px solid var(--brand-green)',
    },
    danger: {
      background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
      color: '#fff',
      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
    },
    success: {
      background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
      color: '#fff',
      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
    }
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{ ...baseStyle, ...variants[variant] }}
    >
      {icon && <span style={{ display: 'flex', fontSize: 18 }}>{icon}</span>}
      {children}
    </button>
  )
}
