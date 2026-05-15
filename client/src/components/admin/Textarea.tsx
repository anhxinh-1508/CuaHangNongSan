import { CSSProperties, TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  containerStyle?: CSSProperties
}

export default function Textarea({ 
  label, 
  error, 
  helperText, 
  containerStyle = {},
  ...props 
}: TextareaProps) {
  const textareaStyle: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 'var(--radius-sm)',
    border: `2px solid ${error ? '#dc2626' : 'var(--border-soft)'}`,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 100,
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
      <textarea
        {...props}
        style={textareaStyle}
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
