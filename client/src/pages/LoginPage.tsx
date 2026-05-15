import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiClock, FiLock, FiLogIn, FiMail, FiKey } from 'react-icons/fi'
import { useAuth } from '../features/auth/context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const err = await login(email, password)
      if (err) setError(err)
      else {
        try {
          const raw = localStorage.getItem('user')
          const u = raw ? (JSON.parse(raw) as { role?: string }) : null
          navigate(u?.role === 'Admin' ? '/admin' : '/')
        } catch {
          navigate('/')
        }
      }
    } catch {
      setError('Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" style={{ maxWidth: 480 }}>
      <div className="auth-card">
      <div className="auth-header">
        <h1 className="auth-title">
          Đăng nhập
        </h1>
        <p className="auth-subtitle">Chào mừng bạn đến với <br /> <b>FRESHFARM ORGANIC</b></p>
      </div>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: 8, 
            fontSize: 14, 
            fontWeight: 600,
            color: '#3C5C2D'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiMail /> Email</span>
          </label>
          <input
            className="input-brand"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ 
              padding: '14px 16px', 
              fontSize: 15,
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
        </div>
        
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: 8, 
            fontSize: 14, 
            fontWeight: 600,
            color: '#3C5C2D'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiLock /> Mật khẩu</span>
          </label>
          <input
            className="input-brand"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              padding: '14px 16px', 
              fontSize: 15,
              outline: 'none',
              transition: 'border-color 0.2s'
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
            boxShadow: loading ? 'none' : '0 4px 12px rgba(60, 92, 45, 0.3)',
            transition: 'all 0.2s'
          }}
        >
          {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiClock /> Đang xử lý...</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiLogIn /> Đăng nhập</span>}
        </button>
      </form>
      
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link 
          to="/forgot-password" 
          style={{ 
            color: '#E2A227', 
            fontSize: 14, 
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiKey /> Quên mật khẩu?</span>
        </Link>
      </div>
      
      <div style={{ 
        marginTop: 24, 
        paddingTop: 24, 
        borderTop: '2px solid #e7e5e4',
        textAlign: 'center'
      }}>
        <p style={{ color: '#737373', fontSize: 14, margin: 0 }}>
          Chưa có tài khoản?{' '}
          <Link 
            to="/register" 
            style={{ 
              color: '#3C5C2D', 
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            Đăng ký ngay →
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}
