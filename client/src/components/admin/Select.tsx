import { CSSProperties, SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: { value: string | number; label: string }[]
  containerStyle?: CSSProperties
}

export default function Select({ 
  label, 
  error, 
  helperText, 
  options,
  containerStyle = {},
  ...props 
}: SelectProps) {
  const selectStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 'var(--radius-sm)',
    border: `2px solid ${error ? '#dc2626' : 'var(--border-soft)'}`,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    background: '#fff',
    cursor: 'pointer',
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
      <select
        {...props}
        style={selectStyle}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
