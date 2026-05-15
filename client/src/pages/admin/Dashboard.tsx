import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiAlertTriangle, FiBarChart2, FiBox, FiCheckCircle, FiDollarSign, FiMail, FiShoppingBag } from 'react-icons/fi'
import api from '../../api/client'
import { mapDashboardStats, unwrapData, type UiDashboardStats } from '../../api/mappers'

export default function AdminDashboard() {
  const [stats, setStats] = useState<UiDashboardStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/dashboard').then((r) => {
      setStats(mapDashboardStats(unwrapData<any>(r.data, {})))
      setError('')
    }).catch(() => setError('Không thể tải số liệu dashboard'))
  }, [])

  if (error) return <div style={{ color: '#dc2626' }}>{error}</div>
  if (!stats) return <div>Đang tải...</div>

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h1 className="section-title" style={{ 
          margin: '0 0 8px', 
          fontSize: 32, 
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontSize: 36, display: 'flex' }}><FiBarChart2 /></span>
          Dashboard
        </h1>
        <p style={{ color: '#737373', fontSize: 15 }}>Tổng quan hệ thống cửa hàng</p>
        <p style={{ margin: '12px 0 0' }}>
          <Link
            to="/admin/reports"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              fontSize: 15,
              color: '#b45309',
              textDecoration: 'none',
            }}
          >
            Xem báo cáo & thống kê chi tiết →
          </Link>
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
        <div style={{ 
          padding: 28, 
          background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
          border: '2px solid #E2A227',
          borderRadius: 16, 
          boxShadow: '0 4px 12px rgba(226, 162, 39, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#737373', fontSize: 14, fontWeight: 600 }}>Doanh thu</p>
            <span style={{ fontSize: 28, display: 'flex' }}><FiDollarSign /></span>
          </div>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#E2A227' }}>
            {stats.totalRevenue?.toLocaleString()}đ
          </p>
        </div>
        
        <div style={{ 
          padding: 28, 
          background: '#fff',
          border: '2px solid #e7e5e4',
          borderRadius: 16, 
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#737373', fontSize: 14, fontWeight: 600 }}>Đơn hàng</p>
            <span style={{ fontSize: 28, display: 'flex' }}><FiShoppingBag /></span>
          </div>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#3C5C2D' }}>
            {stats.totalOrders}
          </p>
        </div>
        
        <div style={{ 
          padding: 28, 
          background: '#fff',
          border: '2px solid #e7e5e4',
          borderRadius: 16, 
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#737373', fontSize: 14, fontWeight: 600 }}>Lô cận hạn</p>
            <span style={{ fontSize: 28, display: 'flex' }}><FiBox /></span>
          </div>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#3C5C2D' }}>
            {stats.nearExpiryCount}
          </p>
        </div>
        
        <div style={{ 
          padding: 28, 
          background: '#fff',
          border: '2px solid #e7e5e4',
          borderRadius: 16, 
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#737373', fontSize: 14, fontWeight: 600 }}>Liên hệ chưa xử lý</p>
            <span style={{ fontSize: 28, display: 'flex' }}><FiMail /></span>
          </div>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#3C5C2D' }}>
            {stats.unresolvedContacts}
          </p>
        </div>
        
        <div style={{ 
          padding: 28, 
          background: stats.cancelRate > 0 
            ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
            : 'linear-gradient(135deg, #f0f9f4 0%, #e6f4ea 100%)',
          border: stats.cancelRate > 0 ? '2px solid #dc2626' : '2px solid #3C5C2D',
          borderRadius: 16, 
          boxShadow: stats.cancelRate > 0 
            ? '0 4px 12px rgba(220, 38, 38, 0.15)'
            : '0 4px 12px rgba(60, 92, 45, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#737373', fontSize: 14, fontWeight: 600 }}>Tỷ lệ hủy đơn</p>
            <span style={{ fontSize: 28, display: 'flex' }}>{stats.cancelRate > 0 ? <FiAlertTriangle /> : <FiCheckCircle />}</span>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: 28, 
            fontWeight: 700, 
            color: stats.cancelRate > 0 ? '#dc2626' : '#3C5C2D' 
          }}>
            {stats.cancelRate.toFixed(2)}%
          </p>
        </div>
      </div>

      {stats.topProducts.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 className="section-title" style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700, color: '#3C5C2D' }}>
            Top bán chạy (đơn đã giao)
          </h2>
          <div
            style={{
              background: '#fff',
              border: '2px solid #e7e5e4',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)', color: '#fff' }}>
                  <th style={{ textAlign: 'left', padding: '14px 18px', fontSize: 14 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '14px 18px', fontSize: 14 }}>Sản phẩm</th>
                  <th style={{ textAlign: 'right', padding: '14px 18px', fontSize: 14 }}>Đã bán</th>
                  <th style={{ textAlign: 'right', padding: '14px 18px', fontSize: 14 }}>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.map((p, idx) => (
                  <tr key={p.id || `${p.name}-${idx}`} style={{ borderBottom: '1px solid #e7e5e4' }}>
                    <td style={{ padding: '12px 18px', color: '#737373', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: '12px 18px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>{p.soldCount.toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#E2A227' }}>
                      {p.revenue.toLocaleString('vi-VN')}đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
