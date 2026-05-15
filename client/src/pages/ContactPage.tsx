import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiMail, FiSend } from 'react-icons/fi'
import api from '../api/client'
import { useAuth } from '../features/auth/context/AuthContext'
import { useResponsive } from '../hooks/useResponsive'

export default function ContactPage() {
  const { user } = useAuth()
  const { isMobile } = useResponsive()
  const [name, setName] = useState(() => user?.name?.trim() ?? '')
  const [email, setEmail] = useState(() => user?.email?.trim() ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!user) return
    setName((prev) => prev.trim() || user.name?.trim() || '')
    setEmail((prev) => prev.trim() || user.email?.trim() || '')
  }, [user])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('Vui lòng điền đầy đủ các trường.')
      return
    }
    setSending(true)
    try {
      await api.post('/contact', {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      })
      setDone(true)
      setSubject('')
      setMessage('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Không gửi được. Vui lòng thử lại sau.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: isMobile ? '0 16px' : '0 24px' }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          color: '#3C5C2D',
          fontWeight: 600,
          textDecoration: 'none',
          fontSize: 15,
        }}
      >
        <FiArrowLeft /> Về trang chủ
      </Link>

      <div
        style={{
          background: '#fff',
          border: '2px solid #e7e5e4',
          borderRadius: 16,
          padding: isMobile ? 22 : 32,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32, color: '#3C5C2D', display: 'flex' }}>
            <FiMail />
          </span>
          <h1 style={{ margin: 0, color: '#3D5C30', fontSize: isMobile ? 24 : 28 }}>Liên hệ</h1>
        </div>
        <p style={{ margin: '0 0 24px', color: '#6b7280', lineHeight: 1.55 }}>
          Gửi câu hỏi hoặc góp ý cho FreshFarm Organic. Chúng tôi sẽ phản hồi qua email bạn cung cấp.
        </p>

        {done && (
          <p
            style={{
              marginBottom: 20,
              padding: 14,
              borderRadius: 10,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#166534',
              fontWeight: 600,
            }}
          >
            Đã gửi liên hệ thành công. Cảm ơn bạn!
          </p>
        )}
        {error && (
          <p style={{ marginBottom: 16, color: '#dc2626', fontWeight: 600 }}>
            {error}
          </p>
        )}

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="ct-name" style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#3D5C30' }}>
              Họ tên <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="ct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '2px solid #e7e5e4',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="ct-email" style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#3D5C30' }}>
              Email <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="ct-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '2px solid #e7e5e4',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="ct-subject" style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#3D5C30' }}>
              Chủ đề <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="ct-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ví dụ: Tư vấn đơn hàng sỉ"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '2px solid #e7e5e4',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label htmlFor="ct-msg" style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#3D5C30' }}>
              Nội dung <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              id="ct-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Nội dung chi tiết…"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '2px solid #e7e5e4',
                fontSize: 15,
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 22px',
              borderRadius: 12,
              border: 'none',
              background: sending ? '#a8a29e' : 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              cursor: sending ? 'not-allowed' : 'pointer',
              boxShadow: sending ? 'none' : '0 4px 12px rgba(60, 92, 45, 0.3)',
            }}
          >
            <FiSend /> {sending ? 'Đang gửi…' : 'Gửi liên hệ'}
          </button>
        </form>
      </div>
    </div>
  )
}
