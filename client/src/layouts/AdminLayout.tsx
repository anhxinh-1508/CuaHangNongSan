import { Outlet, Navigate, useLocation, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../features/auth/context/AuthContext'
import { 
  FiBarChart2, 
  FiBox, 
  FiFolder, 
  FiImage, 
  FiGift, 
  FiShoppingBag, 
  FiUsers, 
  FiMail, 
  FiHome,
  FiMenu,
  FiX,
  FiPackage,
  FiLogOut,
  FiPieChart
} from 'react-icons/fi'

export default function AdminLayout() {
  const { user, isAdmin, authReady, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const menuItems = [
    { href: '/admin', label: 'Dashboard', icon: <FiBarChart2 /> },
    { href: '/admin/reports', label: 'Báo cáo', icon: <FiPieChart /> },
    { href: '/admin/products', label: 'Sản phẩm', icon: <FiBox /> },
    { href: '/admin/batches', label: 'Lô hàng', icon: <FiPackage /> },
    { href: '/admin/categories', label: 'Danh mục', icon: <FiFolder /> },
    { href: '/admin/banners', label: 'Banner', icon: <FiImage /> },
    { href: '/admin/coupons', label: 'Mã giảm giá', icon: <FiGift /> },
    { href: '/admin/orders', label: 'Đơn hàng', icon: <FiShoppingBag /> },
    { href: '/admin/customers', label: 'Khách hàng', icon: <FiUsers /> },
    { href: '/admin/contacts', label: 'Liên hệ', icon: <FiMail /> }
  ]

  /** Phải chờ auth hydrate (localStorage / /users/me). Trước đây !user ở render đầu → luôn Navigate login khi F5 hoặc click <a>. */
  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf9', color: 'var(--text-secondary)' }}>
        Đang tải phiên đăng nhập…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />

  const sidebarStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 280,
    background: 'linear-gradient(180deg, #3C5C2D 0%, #2d4421 100%)',
    color: '#fff',
    padding: 24,
    boxShadow: '4px 0 12px rgba(0, 0, 0, 0.1)',
    position: 'fixed',
    top: 0,
    left: sidebarOpen ? 0 : -280,
    height: '100vh',
    overflowY: 'auto',
    transition: 'left 0.3s ease',
    zIndex: 1000
  }

  const desktopSidebarStyle: React.CSSProperties = {
    ...sidebarStyle,
    position: 'sticky',
    left: 0
  }

  const logoutBtnStyle: React.CSSProperties = {
    marginTop: 8,
    width: '100%',
    cursor: 'pointer',
    color: '#fecaca',
    padding: '12px 16px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 15,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '2px solid rgba(248, 113, 113, 0.35)',
    background: 'rgba(220, 38, 38, 0.18)',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  }

  /** Nền sáng để logo xanh–cam không bị chìm vào sidebar gradient xanh/vàng */
  const sidebarLogoCardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'linear-gradient(180deg, #fffef9 0%, #fef8eb 100%)',
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
  }

  const sidebarLogoTitleStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 16,
    color: '#3d5c30',
    lineHeight: 1.25,
  }

  const sidebarLogoSubStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#57534e',
    fontWeight: 600,
    letterSpacing: '0.06em',
    marginTop: 2,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafaf9' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'none'
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar - Desktop */}
      <aside style={desktopSidebarStyle} className="sidebar-desktop">
        <div style={{ marginBottom: 32 }}>
          <div style={sidebarLogoCardStyle}>
            <img
              src="/Logo.png"
              alt="FreshFarm Organic"
              style={{ height: 48, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={sidebarLogoTitleStyle}>FreshFarm Organic</div>
              <div style={sidebarLogoSubStyle}>ADMIN PANEL</div>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {menuItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? location.pathname === '/admin'
                : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s',
                  background: isActive ? 'rgba(226, 162, 39, 0.2)' : 'transparent',
                  border: isActive ? '2px solid rgba(226, 162, 39, 0.3)' : '2px solid transparent'
                }}
              >
                <span style={{ fontSize: 18, display: 'flex' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}

          <div style={{
            height: 2,
            background: 'rgba(226, 162, 39, 0.3)',
            margin: '16px 0'
          }}></div>

          <Link
            to="/"
            style={{
              color: '#E2A227',
              padding: '12px 16px',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '2px solid rgba(226, 162, 39, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <FiHome /> Về trang chủ
          </Link>

          <button
            type="button"
            onClick={() => logout()}
            style={logoutBtnStyle}
          >
            <span style={{ fontSize: 18, display: 'flex' }}><FiLogOut /></span>
            Đăng xuất
          </button>
        </nav>
      </aside>

      {/* Sidebar - Mobile */}
      <aside style={sidebarStyle} className="sidebar-mobile">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#E2A227' }}>Menu</div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              padding: 4,
              display: 'flex'
            }}
          >
            <FiX />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={sidebarLogoCardStyle}>
            <img
              src="/Logo.png"
              alt="FreshFarm Organic"
              style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={sidebarLogoTitleStyle}>FreshFarm Organic</div>
              <div style={sidebarLogoSubStyle}>ADMIN PANEL</div>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {menuItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? location.pathname === '/admin'
                : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s',
                  background: isActive ? 'rgba(226, 162, 39, 0.2)' : 'transparent',
                  border: isActive ? '2px solid rgba(226, 162, 39, 0.3)' : '2px solid transparent'
                }}
              >
                <span style={{ fontSize: 18, display: 'flex' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}

          <div style={{
            height: 2,
            background: 'rgba(226, 162, 39, 0.3)',
            margin: '16px 0'
          }}></div>

          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            style={{
              color: '#E2A227',
              padding: '12px 16px',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '2px solid rgba(226, 162, 39, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <FiHome /> Về trang chủ
          </Link>

          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false)
              logout()
            }}
            style={logoutBtnStyle}
          >
            <span style={{ fontSize: 18, display: 'flex' }}><FiLogOut /></span>
            Đăng xuất
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, minHeight: '100vh' }}>
        {/* Mobile header */}
        <div className="mobile-header" style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: '#fff',
          borderBottom: '2px solid var(--border-soft)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-green)',
              fontSize: 24,
              cursor: 'pointer',
              padding: 4,
              display: 'flex'
            }}
          >
            <FiMenu />
          </button>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--brand-green)' }}>
            Admin Panel
          </div>
          <div style={{ width: 32 }}></div>
        </div>

        <div style={{ padding: '32px 24px', background: '#fafaf9' }}>
          <Outlet />
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .sidebar-desktop {
            display: none !important;
          }
          .sidebar-mobile {
            display: block !important;
          }
          .mobile-header {
            display: flex !important;
          }
          .mobile-overlay {
            display: block !important;
          }
        }
        @media (min-width: 1025px) {
          .sidebar-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
