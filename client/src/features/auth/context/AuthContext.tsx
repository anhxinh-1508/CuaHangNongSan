import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import api from '../../../api/client'
import { mapUser, unwrapData } from '../../../api/mappers'

type User = { id: string; email: string; name: string; firstName: string; lastName?: string; phone?: string; role: string }

type AuthContextType = {
  user: User | null
  token: string | null
  authReady: boolean
  login: (email: string, password: string) => Promise<string | null>
  register: (data: RegisterData) => Promise<string | null>
  sendOtp: (email: string, type: string) => Promise<string | null>
  verifyOtp: (email: string, otp: string, type: string) => Promise<string | null>
  forgotPassword: (email: string) => Promise<string | null>
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<string | null>
  logout: () => void
  /** Đồng bộ lại user từ GET /users/me (sau khi cập nhật hồ sơ, v.v.) */
  refreshUser: () => Promise<void>
  isAdmin: boolean
}

type RegisterData = { firstName: string; lastName: string; email: string; phone: string; password: string }

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [authReady, setAuthReady] = useState(false)

  const normalizeUser = (raw: Partial<User> | null): User | null => {
    if (!raw) return null
    const name = (raw.name ?? '').trim()
    const firstName = (raw.firstName ?? '').trim() || (name ? name.split(/\s+/).pop() ?? '' : '')
    const lastName = (raw.lastName ?? '').trim() || (name ? name.split(/\s+/).slice(0, -1).join(' ') : '')
    return {
      id: raw.id ?? '',
      email: raw.email ?? '',
      name: name || [lastName, firstName].filter(Boolean).join(' ').trim(),
      firstName: firstName || 'bạn',
      lastName,
      phone: raw.phone ?? '',
      role: raw.role ?? 'Customer',
    }
  }

  const getErrorMessage = (error: unknown, fallback: string) => {
    const maybe = error as { response?: { data?: { message?: string; code?: string } } }
    return maybe.response?.data?.message ?? fallback
  }

  const hydrateFromProfile = async (existingToken: string) => {
    try {
      const { data } = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${existingToken}` },
      })
      const profile = unwrapData<any>(data, null)
      if (!profile) throw new Error('PROFILE_NOT_FOUND')
      const normalized = normalizeUser(mapUser(profile))
      if (normalized) {
        setUser(normalized)
        localStorage.setItem('user', JSON.stringify(normalized))
      }
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
    } finally {
      setAuthReady(true)
    }
  }

  useEffect(() => {
    const u = localStorage.getItem('user')
    const t = localStorage.getItem('token')

    if (t) setToken(t)

    if (u && t) {
      try {
        const normalized = normalizeUser(JSON.parse(u))
        if (normalized) {
          setUser(normalized)
          localStorage.setItem('user', JSON.stringify(normalized))
          setAuthReady(true)
          return
        }
      } catch {
        localStorage.removeItem('user')
      }
    }

    if (t) {
      hydrateFromProfile(t)
      return
    }

    setAuthReady(true)
  }, [])

  const saveAuth = (t: string, u: User) => {
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
  }

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post<{
        data?: { accessToken?: string; user?: { id?: string; _id?: string; name?: string; email?: string; role?: string; phone?: string } }
      }>('/auth/login', { email, password })
      const accessToken = data?.data?.accessToken
      const userData = data?.data?.user
      if (!accessToken || !userData) return 'Đăng nhập thất bại'
      const normalized = normalizeUser(mapUser(userData))
      if (!normalized) return 'Không đọc được dữ liệu người dùng'
      saveAuth(accessToken, normalized)
      return null
    } catch (error) {
      return getErrorMessage(error, 'Đăng nhập thất bại')
    }
  }

  const register = async (d: RegisterData) => {
    try {
      await api.post('/auth/register', { email: d.email })
      return null
    } catch (error) {
      return getErrorMessage(error, 'Không thể gửi OTP đăng ký')
    }
  }

  const sendOtp = async (email: string, type: string) => {
    try {
      await api.post('/auth/resend-verify-otp', { email })
      return null
    } catch (error) {
      return getErrorMessage(error, 'Không thể gửi lại OTP')
    }
  }

  const verifyOtp = async (email: string, otp: string, type: string) => {
    try {
      const payload = type ? JSON.parse(type) : {}
      await api.post('/auth/verify-otp', {
        name: payload.name ?? '',
        email,
        otp,
        password: payload.password ?? '',
      })
      return null
    } catch (error) {
      return getErrorMessage(error, 'Xác thực OTP thất bại')
    }
  }

  const forgotPassword = async (email: string) => {
    try {
      await api.post('/auth/forgot-password', { email })
      return null
    } catch (error) {
      return getErrorMessage(error, 'Không thể gửi OTP đặt lại mật khẩu')
    }
  }

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword })
      return null
    } catch (error) {
      return getErrorMessage(error, 'Đặt lại mật khẩu thất bại')
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    window.location.href = '/'
  }

  const refreshUser = async () => {
    const t = token ?? localStorage.getItem('token')
    if (!t) return
    try {
      const { data } = await api.get('/users/me')
      const profile = unwrapData<any>(data, null)
      if (!profile) return
      const normalized = normalizeUser(mapUser(profile))
      if (normalized) {
        setUser(normalized)
        localStorage.setItem('user', JSON.stringify(normalized))
      }
    } catch {
      /* ignore — caller có thể xử lý lỗi riêng */
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authReady,
        login,
        register,
        sendOtp,
        verifyOtp,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
        isAdmin: user?.role === 'Admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
