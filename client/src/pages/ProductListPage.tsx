import { useEffect, useState } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { FiFilter, FiFolder, FiSearch, FiTag, FiDollarSign, FiShoppingBag } from 'react-icons/fi'
import api from '../api/client'
import { mapCategory, mapProduct, unwrapData, type UiCategory, type UiProduct } from '../api/mappers'
import { VIETNAM_FOOD_CERTIFICATION_OPTIONS } from '../constants/vietnamFoodCertifications'
import { useResponsive } from '../hooks/useResponsive'
import WishlistHeartButton from '../components/WishlistHeartButton'

export default function ProductListPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [products, setProducts] = useState<UiProduct[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<UiCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '')
  const [useTag, setUseTag] = useState(searchParams.get('use') ?? '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '')
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const { isMobile, isTablet } = useResponsive()

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(unwrapData<any[]>(r.data, []).map(mapCategory)))
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(location.search)
    setSearch(p.get('search') ?? '')
    setCategoryId(p.get('category') ?? '')
    setUseTag(p.get('use') ?? '')
    setMinPrice(p.get('minPrice') ?? '')
    setMaxPrice(p.get('maxPrice') ?? '')
    setPage(1)
  }, [location.search])

  const certificationFilterOptions = VIETNAM_FOOD_CERTIFICATION_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }))

  useEffect(() => {
    const params: Record<string, string> = { page: String(page), limit: '12' }
    const kw = search.trim()
    if (kw) params.keyword = kw
    if (useTag.trim()) params.certification = useTag.trim()
    if (categoryId) params.categoryId = categoryId
    if (minPrice) params.minPrice = minPrice
    if (maxPrice) params.maxPrice = maxPrice
    setLoading(true)
    setError('')
    api.get('/products', { params }).then((r) => {
      setProducts(unwrapData<any[]>(r.data, []).map(mapProduct))
      setTotal(r.data?.pagination?.total ?? 0)
    }).catch(() => setError('Không thể tải danh sách sản phẩm.')).finally(() => setLoading(false))
  }, [search, categoryId, useTag, minPrice, maxPrice, page])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      {isMobile && (
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 20,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(60, 92, 45, 0.3)'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FiFilter /> {filterOpen ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}</span>
        </button>
      )}
      
      <div style={{ display: 'flex', gap: 32, flexDirection: isMobile ? 'column' : 'row' }}>
        <aside style={{ 
          width: isMobile ? '100%' : 280, 
          flexShrink: 0,
          display: isMobile && !filterOpen ? 'none' : 'block'
        }}>
          <div style={{ 
            position: isMobile ? 'static' : 'sticky', 
            top: 100,
            background: '#fff',
            border: '2px solid #e7e5e4',
            borderRadius: 16,
            padding: isMobile ? 20 : 24,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)'
          }}>
          <h3 style={{ 
            marginBottom: 20, 
            fontSize: 20, 
            fontWeight: 700, 
            color: '#3C5C2D',
            borderBottom: '3px solid #E2A227',
            paddingBottom: 12
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FiSearch /> Bộ lọc</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <input
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              style={{ 
                padding: '12px 16px', 
                borderRadius: 10, 
                border: '2px solid #e7e5e4',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            <div>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#3C5C2D', display: 'block', marginBottom: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiFolder /> Danh mục</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setPage(1)
                  setCategoryId(e.target.value)
                }}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  borderRadius: 10,
                  border: '2px solid #e7e5e4',
                  fontSize: 14,
                  outline: 'none'
                }}
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#3C5C2D', display: 'block', marginBottom: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiTag /> Chứng nhận</span>
              </label>
              <select 
                value={useTag} 
                onChange={(e) => {
                  setPage(1)
                  setUseTag(e.target.value)
                }} 
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  borderRadius: 10,
                  border: '2px solid #e7e5e4',
                  fontSize: 14,
                  outline: 'none'
                }}
              >
                <option value="">Tất cả chứng nhận / tiêu chí</option>
                {certificationFilterOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ 
              background: '#fffbf0', 
              padding: 16, 
              borderRadius: 10,
              border: '2px solid #E2A227'
            }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#3C5C2D', display: 'block', marginBottom: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FiDollarSign /> Khoảng giá</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input 
                  type="number" 
                  value={minPrice} 
                  onChange={(e) => {
                    setPage(1)
                    setMinPrice(e.target.value)
                  }} 
                  placeholder="Từ (đ)" 
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: 8,
                    border: '1px solid #e7e5e4',
                    fontSize: 14,
                    outline: 'none'
                  }} 
                />
                <input 
                  type="number" 
                  value={maxPrice} 
                  onChange={(e) => {
                    setPage(1)
                    setMaxPrice(e.target.value)
                  }} 
                  placeholder="Đến (đ)" 
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: 8,
                    border: '1px solid #e7e5e4',
                    fontSize: 14,
                    outline: 'none'
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: isMobile ? 20 : 24 }}>
            <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#3C5C2D', margin: 0 }}>
              Danh sách sản phẩm
            </h2>
            <p style={{ color: '#737373', marginTop: 8, fontSize: isMobile ? 14 : 15 }}>Tìm thấy {total} sản phẩm</p>
          </div>
          
          {error && <p style={{ color: '#dc2626' }}>{error}</p>}
          {loading && <p>Đang tải sản phẩm...</p>}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: isMobile ? 20 : 24 }}>
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                background: '#fff',
                border: '2px solid #e7e5e4',
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                height: '100%',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Link to={`/products/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ aspectRatio: '4/3', background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)' }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
                        <FiShoppingBag />
                      </div>
                    )}
                  </div>
                </Link>
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                  <WishlistHeartButton productId={p.id} />
                </div>
              </div>
              <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ padding: 16 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 600, color: '#1a1a1a' }}>{p.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#E2A227', fontSize: 19 }}>
                        {p.price?.toLocaleString()}đ
                      </p>
                      {p.unit ? (
                        <span style={{ fontSize: 13, color: '#737373', fontWeight: 500 }}>
                          / {p.unit}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ 
                      background: '#3C5C2D',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: 16,
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      Xem
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
        
        <div style={{ 
          marginTop: 40, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: 12 
        }}>
          <button 
            disabled={page <= 1} 
            onClick={() => setPage((p) => p - 1)} 
            style={{ 
              padding: '10px 20px', 
              borderRadius: 10, 
              border: '2px solid #3C5C2D',
              background: page <= 1 ? '#f5f5f4' : '#fff',
              color: page <= 1 ? '#a3a3a3' : '#3C5C2D',
              fontWeight: 600,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ← Trước
          </button>
          <span style={{ 
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #3C5C2D 0%, #4d7339 100%)',
            color: '#fff',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15
          }}>
            Trang {page}
          </span>
          <button 
            disabled={page * 12 >= total} 
            onClick={() => setPage((p) => p + 1)} 
            style={{ 
              padding: '10px 20px', 
              borderRadius: 10, 
              border: '2px solid #3C5C2D',
              background: page * 12 >= total ? '#f5f5f4' : '#fff',
              color: page * 12 >= total ? '#a3a3a3' : '#3C5C2D',
              fontWeight: 600,
              cursor: page * 12 >= total ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Sau →
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
