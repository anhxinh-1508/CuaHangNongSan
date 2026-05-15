import { ReactNode, CSSProperties, useEffect } from 'react'
import { FiX } from 'react-icons/fi'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: number | string
}

export default function Modal({ isOpen, onClose, title, children, footer, width = 600 }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
    overflowY: 'auto'
  }

  const modalStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
    width: '100%',
    maxWidth: width,
    maxHeight: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column',
    margin: 'auto'
  }

  const headerStyle: CSSProperties = {
    padding: '24px 28px',
    borderBottom: '2px solid var(--border-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0
  }

  const bodyStyle: CSSProperties = {
    padding: '28px',
    overflowY: 'auto',
    flex: 1
  }

  const footerStyle: CSSProperties = {
    padding: '20px 28px',
    borderTop: '2px solid var(--border-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    flexShrink: 0
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--brand-green)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#737373',
              display: 'flex',
              padding: 4
            }}
          >
            <FiX />
          </button>
        </div>
        <div style={bodyStyle}>
          {children}
        </div>
        {footer && (
          <div style={footerStyle}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
