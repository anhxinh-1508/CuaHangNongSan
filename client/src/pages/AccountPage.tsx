import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { FiEdit2, FiSave, FiX } from 'react-icons/fi'
import api from '../api/client'
import { mapUser, unwrapData } from '../api/mappers'
import { useAuth } from '../features/auth/context/AuthContext'
import { useResponsive } from '../hooks/useResponsive'

type Profile = { id: string; name: string; email: string; phone?: string }

function normalizeVNPhone(input: string): string {
  let d = input.trim().replace(/[\s.-]/g, '').replace(/\D/g, '')
  if (d.startsWith('84') && d.length >= 10) d = `0${d.slice(2)}`
  return d
}

function isValidVNMobilePhone(digits: string): boolean {
  return /^0[35789]\d{8}$/.test(digits)
}

export default function AccountPage() {
  const { user, authReady, refreshUser } = useAuth()
  const { isMobile } = useResponsive()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [saveOk, setSaveOk] = useState('')

  const loadProfile = () => {
    if (!authReady || !user) return
    setLoading(true)
    api
      .get('/users/me')
      .then((r) => {
        setProfile(mapUser(unwrapData<any>(r.data, {})))
        setError('')
      })
      .catch(() => {
        setProfile(null)
        setError('Không thể tải hồ sơ tài khoản.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProfile()
  }, [authReady, user])

  const openEdit = () => {
    const p = profile
    setFormName((p?.name || user?.name || '').trim())
    setFormPhone((p?.phone || user?.phone || '').trim())
    setFormError('')
    setSaveOk('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setFormError('')
    setSaveOk('')
  }

  const saveProfile = async () => {
    const name = formName.trim()
    if (!name) {
      setFormError('Vui lòng nhập họ tên.')
      return
    }
    const phoneNorm = normalizeVNPhone(formPhone)
    if (formPhone.trim() && !isValidVNMobilePhone(phoneNorm)) {
      setFormError('Số điện thoại không hợp lệ (10 số, ví dụ 0912345678).')
      return
    }
    setSaving(true)
    setFormError('')
    setSaveOk('')
    try {
      const { data } = await api.put('/auth/profile', {
        name,
        phone: formPhone.trim() ? phoneNorm : '',
      })
      const updated = unwrapData<any>(data, null)
      if (updated && typeof updated === 'object') {
        setProfile(mapUser(updated))
      } else {
        loadProfile()
      }
      await refreshUser()
      setSaveOk('Đã lưu thông tin cá nhân.')
      setEditing(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setFormError(msg || 'Không thể cập nhật. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (!authReady) {
    return (
      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 20px', color: '#6b7280' }}>
        Đang tải thông tin tài khoản...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const displayName = profile?.name || user.name
  const displayEmail = profile?.email || user.email
  const displayPhone = profile?.phone || user.phone || ''
  const phoneLabel = displayPhone ? displayPhone : 'Chưa cập nhật'

  const labelCol: CSSProperties = {
    color: '#6b7280',
    fontWeight: 600,
    minWidth: isMobile ? undefined : 140,
  }

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 20px' }}>
      <div
        style={{
          background: '#fff',
          border: '2px solid #e7e5e4',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
        }}
      >
        <h1 style={{ margin: '0 0 16px', color: '#3D5C30', fontSize: 28 }}>Quản lý tài khoản</h1>
        <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Thông tin tài khoản hiện tại của bạn.</p>
        {loading && <p style={{ marginBottom: 12 }}>Đang đồng bộ hồ sơ...</p>}
        {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}
        {saveOk && !editing && (
          <p style={{ color: '#166534', marginBottom: 16, fontWeight: 600 }}>{saveOk}</p>
        )}

        {!editing ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '180px 1fr',
                rowGap: 14,
                columnGap: 16,
              }}
            >
              <div style={labelCol}>Họ tên</div>
              <div style={{ color: '#111827', fontWeight: 600 }}>{displayName}</div>

              <div style={labelCol}>Email</div>
              <div style={{ color: '#111827', fontWeight: 600 }}>{displayEmail}</div>

              <div style={labelCol}>Số điện thoại</div>
              <div style={{ color: '#111827', fontWeight: 600 }}>{phoneLabel}</div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                onClick={openEdit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#fff',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(60, 92, 45, 0.25)',
                }}
              >
                <FiEdit2 /> Chỉnh sửa thông tin
              </button>
            </div>
          </>
        ) : (
          <div style={{ maxWidth: 480 }}>
            {formError && (
              <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{formError}</p>
            )}
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="acc-name"
                style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#3D5C30', fontSize: 14 }}
              >
                Họ tên <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="acc-name"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value)
                  setFormError('')
                }}
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
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#6b7280', fontSize: 14 }}>
                Email
              </label>
              <input
                value={displayEmail}
                disabled
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: '2px solid #e7e5e4',
                  fontSize: 15,
                  boxSizing: 'border-box',
                  background: '#f5f5f4',
                  color: '#57534e',
                }}
              />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#78716c' }}>Email không đổi được tại đây.</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="acc-phone"
                style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#3D5C30', fontSize: 14 }}
              >
                Số điện thoại
              </label>
              <input
                id="acc-phone"
                type="tel"
                inputMode="numeric"
                value={formPhone}
                onChange={(e) => {
                  setFormPhone(e.target.value)
                  setFormError('')
                }}
                placeholder="Ví dụ: 0912345678"
                autoComplete="tel"
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#fff',
                  fontWeight: 700,
                  background: saving ? '#a8a29e' : 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : '0 4px 12px rgba(60, 92, 45, 0.25)',
                }}
              >
                <FiSave /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#44403c',
                  fontWeight: 600,
                  background: '#fff',
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '2px solid #e7e5e4',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <FiX /> Hủy
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link
            to="/orders"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              color: '#fff',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
              padding: '10px 18px',
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(60, 92, 45, 0.25)',
            }}
          >
            Đơn hàng của tôi
          </Link>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              color: '#3D5C30',
              fontWeight: 700,
              background: '#fff8e8',
              border: '1px solid #f1d58b',
              padding: '10px 16px',
              borderRadius: 10,
            }}
          >
            ← Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  )
}
