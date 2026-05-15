import { CSSProperties, InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  containerStyle?: CSSProperties
}

export default function Input({ 
  label, 
  error, 
  helperText, 
  containerStyle = {},
  ...props 
}: InputProps) {
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 'var(--radius-sm)',
    border: `2px solid ${error ? '#dc2626' : 'var(--border-soft)'}`,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{ marginBottom: 20, ...containerStyle }}>
      {label && (
        <label style={{ 
          display: 'block', 
          marginBottom: 8, 
          fontWeight: 600, 
          fontSize: 14,
          color: 'var(--text-primary)'
        }}>
          {label}
          {props.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
        </label>
      )}
      <input
        {...props}
        style={inputStyle}
      />
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#dc2626' }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          {helperText}
        </p>
      )}
    </div>
  )
}
