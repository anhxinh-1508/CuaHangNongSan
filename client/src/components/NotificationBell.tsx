import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { FiBell, FiX } from 'react-icons/fi'
import { useAuth } from '../features/auth/context/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import { useResponsive } from '../hooks/useResponsive'
import type { UiNotification } from '../api/notifications'
import { formatNotificationTime, notificationTypeLabel } from '../utils/notificationDisplay'
import '../styles/notifications.css'

type Variant = 'storefront' | 'admin'

type Props = {
  variant?: Variant
}

export default function NotificationBell({ variant = 'storefront' }: Props) {
  const { user, authReady } = useAuth()
  const navigate = useNavigate()
  const { isDesktop } = useResponsive()
  const useSheet = !isDesktop
  const enabled = authReady && Boolean(user)
  const { items, unreadCount, loading, error, refresh, markRead, markAllRead } = useNotifications(enabled)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !useSheet) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, useSheet])

  useEffect(() => {
    if (!open || useSheet) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, useSheet])

  const handleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) refresh()
  }

  const handleItemClick = async (n: UiNotification) => {
    if (!n.isRead) await markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  if (!enabled) return null

  const triggerClass =
    variant === 'admin'
      ? 'notification-bell__trigger notification-bell__trigger--admin'
      : 'notification-bell__trigger notification-bell__trigger--storefront'

  const panelContent = (
    <>
      <div className="notification-bell__panel-header">
        <h3 className="notification-bell__panel-title">Thông báo</h3>
        <div className="notification-bell__panel-actions">
          <button
            type="button"
            className="notification-bell__mark-all"
            disabled={unreadCount === 0 || loading}
            onClick={() => markAllRead()}
          >
            Đọc tất cả
          </button>
          {useSheet && (
            <button
              type="button"
              className="notification-bell__close"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
            >
              <FiX size={22} />
            </button>
          )}
        </div>
      </div>

      <div className="notification-bell__list">
        {loading && items.length === 0 && (
          <p className="notification-bell__loading">Đang tải…</p>
        )}
        {error && !loading && items.length === 0 && (
          <p className="notification-bell__error">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="notification-bell__empty">Chưa có thông báo</p>
        )}
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`notification-bell__item${n.isRead ? '' : ' notification-bell__item--unread'}`}
            onClick={() => handleItemClick(n)}
          >
            <div className="notification-bell__item-top">
              <span className="notification-bell__item-title">{n.title}</span>
              <span className="notification-bell__item-type">{notificationTypeLabel(n.type)}</span>
            </div>
            <p className="notification-bell__item-message">{n.message}</p>
            <p className="notification-bell__item-time">{formatNotificationTime(n.createdAt)}</p>
          </button>
        ))}
      </div>
    </>
  )

  const sheetPanel =
    open &&
    useSheet &&
    createPortal(
      <div className="notification-bell__sheet-root" role="presentation">
        <button
          type="button"
          className="notification-bell__backdrop"
          onClick={() => setOpen(false)}
          aria-label="Đóng thông báo"
        />
        <div
          className="notification-bell__panel notification-bell__panel--sheet"
          role="dialog"
          aria-label="Danh sách thông báo"
          aria-modal="true"
        >
          {panelContent}
        </div>
      </div>,
      document.body,
    )

  return (
    <div className={`notification-bell${open ? ' notification-bell--open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        onClick={handleOpen}
        aria-label="Thông báo"
        aria-expanded={open}
        title="Thông báo"
      >
        <FiBell size={variant === 'admin' ? 20 : 22} />
        {unreadCount > 0 && (
          <span className="notification-bell__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && !useSheet && (
        <div className="notification-bell__panel" role="dialog" aria-label="Danh sách thông báo">
          {panelContent}
        </div>
      )}

      {sheetPanel}
    </div>
  )
}
