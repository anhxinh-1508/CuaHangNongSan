import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiCheckCircle, FiClock, FiHash, FiLock, FiMail, FiPhone, FiUserPlus } from 'react-icons/fi'
import { useAuth } from '../features/auth/context/AuthContext'

export default function RegisterPage() {
  const { register, sendOtp, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' })
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const registerErr = await register(form)
      if (registerErr) {
        setError(registerErr)
        return
      }
      const err = await sendOtp(form.email, 'Register')
      if (err) setError(err)
      else setStep('otp')
    } catch {
      setError('Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const err = await verifyOtp(
        form.email,
        otp,
        JSON.stringify({
          name: `${form.lastName} ${form.firstName}`.trim(),
          password: form.password,
        }),
      )
      if (err) setError(err)
      else {
        alert('Xác thực thành công! Vui lòng đăng nhập.')
        navigate('/login')
      }
    } catch {
      setError('Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'otp') {
    return (
      <div className="auth-page" style={{ maxWidth: 480 }}>
        <div className="auth-card">
        <div className="auth-header">
          <div style={{ fontSize: 72, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><FiMail /></div>
          <h1 className="auth-title" style={{ marginBottom: 12 }}>
            Xác thực OTP
          </h1>
          <p className="auth-subtitle">
            Mã OTP đã được gửi đến<br/>
            <strong style={{ color: '#E2A227' }}>{form.email}</strong>
          </p>
        </div>
        
        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              fontSize: 14, 
              fontWeight: 600,
              color: '#3C5C2D'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiHash /> Mã OTP (6 số)</span>
            </label>
            <input
              className="input-brand"
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
              style={{ 
                padding: '14px 16px', 
                fontSize: 18,
                fontWeight: 600,
                textAlign: 'center',
                letterSpacing: '4px',
                outline: 'none'
              }}
            />
          </div>
          
          {error && (
            <div style={{ 
              padding: 12, 
              background: '#fee2e2', 
              border: '2px solid #dc2626',
              borderRadius: 10,
              color: '#dc2626',
              fontSize: 14,
              fontWeight: 500
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiAlertCircle /> {error}</span>
            </div>
          )}
          
          <button 
            className="btn-brand btn-brand-green"
            type="submit" 
            disabled={loading} 
            style={{ 
              background: loading ? '#d4d4d8' : undefined,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(60, 92, 45, 0.3)'
            }}
          >
            {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiClock /> Đang xác thực...</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiCheckCircle /> Xác thực</span>}
          </button>
        </form>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page" style={{ maxWidth: 520 }}>
      <div className="auth-card">
      <div className="auth-header">
        <h1 className="auth-title">
          Tạo tài khoản
        </h1>
      </div>
      
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#3C5C2D' }}>
              Họ *
            </label>
            <input
              className="input-brand"
              placeholder="Nguyễn"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              required
              style={{ 
                padding: '12px 14px', 
                fontSize: 15,
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#3C5C2D' }}>
              Tên *
            </label>
            <input
              className="input-brand"
              placeholder="Văn A"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
              style={{ 
                padding: '12px 14px', 
                fontSize: 15,
                outline: 'none'
              }}
            />
          </div>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#3C5C2D' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiMail /> Email *</span>
          </label>
          <input
            className="input-brand"
            type="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            style={{ 
              padding: '12px 14px', 
              fontSize: 15,
              outline: 'none'
            }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#3C5C2D' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiPhone /> Số điện thoại *</span>
          </label>
          <input
            className="input-brand"
            type="tel"
            placeholder="0901234567"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            required
            style={{ 
              padding: '12px 14px', 
              fontSize: 15,
              outline: 'none'
            }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#3C5C2D' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiLock /> Mật khẩu *</span>
          </label>
          <input
            className="input-brand"
            type="password"
            placeholder="Tối thiểu 6 ký tự"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={6}
            style={{ 
              padding: '12px 14px', 
              fontSize: 15,
              outline: 'none'
            }}
          />
        </div>
        
        {error && (
          <div style={{ 
            padding: 12, 
            background: '#fee2e2', 
            border: '2px solid #dc2626',
            borderRadius: 10,
            color: '#dc2626',
            fontSize: 14,
            fontWeight: 500
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiAlertCircle /> {error}</span>
          </div>
        )}
        
        <button 
          className="btn-brand btn-brand-gold"
          type="submit" 
          disabled={loading} 
          style={{ 
            background: loading ? '#d4d4d8' : undefined,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(226, 162, 39, 0.3)',
            marginTop: 8
          }}
        >
          {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiClock /> Đang xử lý...</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiUserPlus /> Đăng ký ngay</span>}
        </button>
      </form>
      
      <div style={{ 
        marginTop: 24, 
        paddingTop: 24, 
        borderTop: '2px solid #e7e5e4',
        textAlign: 'center'
      }}>
        <p style={{ color: '#737373', fontSize: 14, margin: 0 }}>
          Đã có tài khoản?{' '}
          <Link 
            to="/login" 
            style={{ 
              color: '#3C5C2D', 
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            Đăng nhập →
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}
