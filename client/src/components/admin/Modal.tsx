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

  const maxW =
    typeof width === 'number'
      ? `min(${width}px, calc(100vw - 32px))`
      : width

  const modalStyle: CSSProperties = {
    background: '#fff',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
    width: '100%',
    maxWidth: maxW,
    maxHeight: 'calc(100vh - 32px)',
    display: 'flex',
    flexDirection: 'column',
    margin: 'auto',
    minWidth: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  }

  const headerStyle: CSSProperties = {
    padding: '20px 24px',
    borderBottom: '2px solid var(--border-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0
  }

  const bodyStyle: CSSProperties = {
    padding: '24px',
    overflowX: 'hidden',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  }

  const footerStyle: CSSProperties = {
    padding: '16px 24px',
    borderTop: '2px solid var(--border-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    flexShrink: 0,
    flexWrap: 'wrap',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div className="modal-content" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={headerStyle}>
          <h2 className="modal-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--brand-green)' }}>
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
        <div className="modal-body" style={bodyStyle}>
          {children}
        </div>
        {footer && (
          <div className="modal-footer admin-button-group" style={footerStyle}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
