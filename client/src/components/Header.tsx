import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiBox, FiChevronDown, FiHeart, FiHome, FiLogIn, FiLogOut, FiMail, FiPackage, FiSearch, FiSettings, FiShoppingCart, FiUser, FiUserPlus } from 'react-icons/fi'
import { useAuth } from '../features/auth/context/AuthContext'
import { useWishlist } from '../features/wishlist/context/WishlistContext'
import api from '../api/client'
import { unwrapData } from '../api/mappers'
import { CART_UPDATED_EVENT } from '../utils/cartEvents'

function CartIconWithBadge({ count }: { count: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 20, display: 'flex' }}>
        <FiShoppingCart />
      </span>
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -7,
            right: -10,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 10,
            background: '#b45309',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            border: '2px solid #fff',
            boxSizing: 'border-box',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  )
}

function WishlistIconWithBadge({ count }: { count: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 20, display: 'flex' }}>
        <FiHeart style={count > 0 ? { fill: 'currentColor' } : undefined} />
      </span>
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -7,
            right: -10,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 10,
            background: '#b91c1c',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            border: '2px solid #fff',
            boxSizing: 'border-box',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  )
}

export default function Header() {
  const { user, logout } = useAuth()
  const { count: wishlistCount } = useWishlist()
  const [cartCount, setCartCount] = useState(0)
  const greetingName = user?.firstName || user?.name?.trim()?.split(/\s+/).pop() || 'bạn'
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [headerSearch, setHeaderSearch] = useState('')

  useEffect(() => {
    if (location.pathname === '/products') {
      const s = new URLSearchParams(location.search).get('search') ?? ''
      setHeaderSearch(s)
    }
  }, [location.pathname, location.search])

  const submitStorefrontSearch = (e?: FormEvent) => {
    e?.preventDefault()
    const q = headerSearch.trim()
    const params = new URLSearchParams(location.pathname === '/products' ? location.search : '')
    if (q) params.set('search', q)
    else params.delete('search')
    const tail = params.toString()
    navigate(tail ? `/products?${tail}` : '/products')
    setMenuOpen(false)
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const refreshCartCount = useCallback(async () => {
    if (!user) {
      setCartCount(0)
      return
    }
    try {
      const r = await api.get('/cart')
      const payload = unwrapData<any>(r.data, { items: [] })
      const items = payload?.items ?? []
      setCartCount(items.length)
    } catch {
      setCartCount(0)
    }
  }, [user])

  useEffect(() => {
    refreshCartCount()
  }, [refreshCartCount])

  useEffect(() => {
    const onCartUpdated = () => refreshCartCount()
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated)
    return () => window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated)
  }, [refreshCartCount])

  return (
    <header
      className="header-brand"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '16px 32px',
          gap: 12,
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img
            src="/Logo.png"
            alt="FreshFarm Organic"
            style={{
              height: isMobile ? 40 : 54,
              width: 'auto',
              objectFit: 'contain',
            }}
          />
        </Link>

        {isMobile && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: '#f7faf6',
              border: '2px solid #d7e4d1',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ width: 24, height: 3, background: '#3D5C30', borderRadius: 2 }}></div>
            <div style={{ width: 24, height: 3, background: '#3D5C30', borderRadius: 2 }}></div>
            <div style={{ width: 24, height: 3, background: '#3D5C30', borderRadius: 2 }}></div>
          </button>
        )}

        {!isMobile && (
          <>
            <nav style={{ display: 'flex', gap: 32, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
              <Link to="/" style={{ color: '#3D5C30', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Trang chủ</Link>
              <Link to="/products" style={{ color: '#3D5C30', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Sản phẩm</Link>
              <Link to="/contact" style={{ color: '#3D5C30', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Liên hệ</Link>
              <form onSubmit={submitStorefrontSearch} style={{ position: 'relative', margin: 0 }}>
                <input
                  type="search"
                  name="q"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder="Tìm kiếm nông sản..."
                  aria-label="Tìm kiếm sản phẩm"
                  style={{
                    padding: '10px 16px 10px 40px',
                    borderRadius: 24,
                    border: '2px solid #d7e4d1',
                    width: 280,
                    background: '#f7faf6',
                    color: '#1f2937',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#3D5C30', display: 'flex', pointerEvents: 'none' }}><FiSearch /></span>
              </form>
            </nav>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {user ? (
                <>
                  <Link to="/wishlist" style={{
                    color: '#3D5C30',
                    fontWeight: 600,
                    fontSize: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#fff5f5',
                    padding: '8px 16px',
                    borderRadius: 24,
                    border: '1px solid #fecaca',
                    textDecoration: 'none',
                  }}>
                    <WishlistIconWithBadge count={wishlistCount} />
                    Yêu thích
                  </Link>
                  <Link to="/cart" style={{ 
                    color: '#3D5C30', 
                    fontWeight: 600, 
                    fontSize: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#f7faf6',
                    padding: '8px 16px',
                    borderRadius: 24,
                    border: '1px solid #d7e4d1',
                    textDecoration: 'none'
                  }}>
                    <CartIconWithBadge count={cartCount} />
                    Giỏ hàng
                  </Link>
                  <div ref={userMenuRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setUserMenuOpen((v) => !v)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#fff8e8',
                        padding: '8px 14px',
                        borderRadius: 24,
                        border: '1px solid #f1d58b',
                        cursor: 'pointer',
                        color: '#3D5C30',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      <span style={{ fontSize: 18, display: 'flex' }}><FiUser /></span>
                      <span>Xin chào, {greetingName}</span>
                      <span style={{ fontSize: 12, display: 'flex' }}><FiChevronDown /></span>
                    </button>
                    {userMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 46,
                          right: 0,
                          minWidth: 220,
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12)',
                          padding: 8,
                          zIndex: 120,
                        }}
                      >
                        <Link
                          to="/account"
                          onClick={() => setUserMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 12px',
                            color: '#3D5C30',
                            textDecoration: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          Quản lý tài khoản
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 12px',
                            color: '#3D5C30',
                            textDecoration: 'none',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          Đơn hàng của tôi
                        </Link>
                        {user.role === 'Admin' && (
                          <Link
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            style={{
                              display: 'block',
                              padding: '10px 12px',
                              color: '#3D5C30',
                              textDecoration: 'none',
                              borderRadius: 8,
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            Admin
                          </Link>
                        )}
                        <button
                          onClick={logout}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: '#b91c1c',
                            cursor: 'pointer',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          Đăng xuất
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" style={{ 
                    color: '#3D5C30',
                    fontWeight: 600,
                    fontSize: 14,
                    padding: '8px 20px',
                    borderRadius: 24,
                    border: '2px solid #d7e4d1',
                    background: '#f7faf6',
                    textDecoration: 'none'
                  }}>
                    Đăng nhập
                  </Link>
                  <Link to="/register" style={{ 
                    color: '#3D5C30',
                    background: '#E3A127',
                    fontWeight: 600,
                    fontSize: 14,
                    padding: '8px 20px',
                    borderRadius: 24,
                    boxShadow: '0 4px 8px rgba(227, 161, 39, 0.3)',
                    textDecoration: 'none'
                  }}>
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {isMobile && menuOpen && (
        <div style={{
          background: '#fff',
          padding: 20,
          borderTop: '1px solid #f1d58b'
        }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <form onSubmit={submitStorefrontSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #e7e5e4' }}>
              <input
                type="search"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                placeholder="Tìm sản phẩm..."
                aria-label="Tìm kiếm sản phẩm"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '2px solid #d7e4d1',
                  background: '#f7faf6',
                  fontSize: 14,
                }}
              />
              <button type="submit" style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#3D5C30', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}>
                <FiSearch /> Tìm
              </button>
            </form>
            <Link to="/" onClick={() => setMenuOpen(false)} style={{ color: '#3D5C30', fontWeight: 600, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiHome /> Trang chủ</Link>
            <Link to="/products" onClick={() => setMenuOpen(false)} style={{ color: '#3D5C30', fontWeight: 600, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiBox /> Sản phẩm</Link>
            <Link to="/contact" onClick={() => setMenuOpen(false)} style={{ color: '#3D5C30', fontWeight: 600, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiMail /> Liên hệ</Link>
            {user ? (
              <>
                <Link to="/wishlist" onClick={() => setMenuOpen(false)} style={{ color: '#b91c1c', fontWeight: 700, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <WishlistIconWithBadge count={wishlistCount} />
                  Yêu thích
                </Link>
                <Link to="/cart" onClick={() => setMenuOpen(false)} style={{ color: '#E3A127', fontWeight: 700, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CartIconWithBadge count={cartCount} />
                  Giỏ hàng
                </Link>
                <Link to="/orders" onClick={() => setMenuOpen(false)} style={{ color: '#3D5C30', fontWeight: 700, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiPackage /> Đơn hàng của tôi</Link>
                <Link to="/account" onClick={() => setMenuOpen(false)} style={{ color: '#E3A127', fontWeight: 700, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiUser /> Quản lý tài khoản</Link>
                {user.role === 'Admin' && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)} style={{ color: '#E3A127', fontWeight: 700, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiSettings /> Admin</Link>
                )}
                <button 
                  onClick={() => { logout(); setMenuOpen(false); }} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#3D5C30', 
                    textAlign: 'left', 
                    fontSize: 16, 
                    padding: '8px 0',
                    fontWeight: 600
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiLogOut /> Đăng xuất</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} style={{ color: '#E3A127', fontWeight: 700, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiLogIn /> Đăng nhập</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} style={{ color: '#E3A127', fontWeight: 700, fontSize: 16, textDecoration: 'none', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FiUserPlus /> Đăng ký</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
