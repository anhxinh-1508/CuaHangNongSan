import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Không ép về /login khi token hết hạn trên hydrate hoặc API công khai — tránh khách bị đá khỏi trang SP. */
function shouldRedirectLoginOn401(url: string) {
  const path = String(url)
  if (path.includes('/users/me')) return false
  if (path.includes('/auth/')) return false
  if (['/products', '/categories', '/banners', '/contact'].some((p) => path.includes(p))) return false
  return true
}

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (shouldRedirectLoginOn401(e.config?.url ?? '')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(e)
  }
)

export default api
