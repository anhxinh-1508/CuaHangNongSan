import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/context/AuthContext'

export default function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await forgotPassword(email)
    if (err) setError(err)
    else setStep('reset')
    setLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await resetPassword(email, otp, newPassword)
    if (err) setError(err)
    else navigate('/login')
    setLoading(false)
  }

  return (
    <div className="auth-page" style={{ maxWidth: 480 }}>
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">{step === 'request' ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}</h1>
          <p className="auth-subtitle">
            {step === 'request' ? 'Nhập email để nhận OTP đặt lại mật khẩu.' : 'Nhập OTP và mật khẩu mới để hoàn tất.'}
          </p>
        </div>

        <form onSubmit={step === 'request' ? handleRequestOtp : handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input-brand" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          {step === 'reset' && (
            <>
              <input className="input-brand" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Mã OTP" required maxLength={6} />
              <input
                className="input-brand"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mật khẩu mới (>= 6 ký tự)"
                required
                minLength={6}
              />
            </>
          )}
          {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
          <button className="btn-brand btn-brand-green" type="submit" disabled={loading}>
            {loading ? 'Đang xử lý...' : step === 'request' ? 'Gửi OTP' : 'Cập nhật mật khẩu'}
          </button>
        </form>
        <div style={{ marginTop: 18 }}>
          <Link to="/login" style={{ color: '#3C5C2D', fontWeight: 700, textDecoration: 'none' }}>
            ← Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  )
}
