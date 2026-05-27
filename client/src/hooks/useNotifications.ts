import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UiNotification,
} from '../api/notifications'

const POLL_MS = 60_000

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<UiNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([])
      setUnreadCount(0)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchNotifications(1, 20)
      if (!mountedRef.current) return
      setItems(res.data)
      setUnreadCount(res.unreadCount)
    } catch {
      if (!mountedRef.current) return
      setError('Không tải được thông báo')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    if (!enabled) return () => { mountedRef.current = false }

    const timer = window.setInterval(refresh, POLL_MS)
    return () => {
      mountedRef.current = false
      window.clearInterval(timer)
    }
  }, [enabled, refresh])

  const markRead = useCallback(
    async (id: string) => {
      const target = items.find((n) => n.id === id)
      if (!target || target.isRead) return
      try {
        await markNotificationRead(id)
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        setError('Không cập nhật được thông báo')
      }
    },
    [items],
  )

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      setError('Không cập nhật được thông báo')
    }
  }, [unreadCount])

  return { items, unreadCount, loading, error, refresh, markRead, markAllRead }
}
