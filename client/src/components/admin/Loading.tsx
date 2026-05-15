import { CSSProperties } from 'react'

interface LoadingProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  fullScreen?: boolean
}

export default function Loading({ size = 'medium', color = 'var(--brand-green)', fullScreen = false }: LoadingProps) {
  const sizeMap = {
    small: 24,
    medium: 48,
    large: 72
  }

  const dimension = sizeMap[size]

  const containerStyle: CSSProperties = fullScreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.9)',
    zIndex: 9999
  } : {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  }

  const spinnerStyle: CSSProperties = {
    width: dimension,
    height: dimension,
    border: `4px solid ${color}20`,
    borderTop: `4px solid ${color}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }

  return (
    <div style={containerStyle}>
      <div style={spinnerStyle}></div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
