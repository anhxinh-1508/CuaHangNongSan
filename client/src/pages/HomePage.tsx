import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FiCheckCircle, FiChevronLeft, FiChevronRight, FiFeather, FiShoppingBag, FiTruck } from 'react-icons/fi'
import api from '../api/client'
import { mapBanner, mapCategory, mapProduct, unwrapData, type UiBanner, type UiCategory, type UiProduct } from '../api/mappers'
import { useResponsive } from '../hooks/useResponsive'
import WishlistHeartButton from '../components/WishlistHeartButton'

const BANNER_AUTO_MS = 5000
const HOT_FETCH_LIMIT = 40
const HOT_AUTO_MS = 3000

function formatLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWithSeed<T>(items: T[], seedStr: string): T[] {
  const rng = mulberry32(hashString(seedStr))
  const a = [...items]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function chunkProducts<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export default function HomePage() {
  const [banners, setBanners] = useState<UiBanner[]>([])
  const [bannerIndex, setBannerIndex] = useState(0)
  const [categories, setCategories] = useState<UiCategory[]>([])
  const [products, setProducts] = useState<UiProduct[]>([])
  const [hotPoolProducts, setHotPoolProducts] = useState<UiProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bannerPauseAuto, setBannerPauseAuto] = useState(false)
  const [hotSlideIndex, setHotSlideIndex] = useState(0)
  const [hotPauseAuto, setHotPauseAuto] = useState(false)
  const { isMobile, isTablet } = useResponsive()

  const hotPerSlide = isMobile ? 2 : isTablet ? 3 : 4

  const hotDateKey = useMemo(() => formatLocalYYYYMMDD(new Date()), [])

  const hotDailyOrdered = useMemo(
    () => shuffleWithSeed(hotPoolProducts, hotDateKey),
    [hotPoolProducts, hotDateKey]
  )

  const hotPages = useMemo(() => chunkProducts(hotDailyOrdered, hotPerSlide), [hotDailyOrdered, hotPerSlide])

  const nHotPages = hotPages.length

  const goHotSlide = useCallback(
    (delta: number) => {
      if (nHotPages <= 0) return
      setHotSlideIndex((i) => (i + delta + nHotPages) % nHotPages)
    },
    [nHotPages]
  )

  useEffect(() => {
    setHotSlideIndex(0)
  }, [nHotPages, hotDateKey, hotPerSlide])

  useEffect(() => {
    if (nHotPages <= 1 || hotPauseAuto) return
    const id = window.setInterval(() => {
      setHotSlideIndex((i) => (i + 1) % nHotPages)
    }, HOT_AUTO_MS)
    return () => clearInterval(id)
  }, [nHotPages, hotPauseAuto])

  const bannerHeight = isMobile ? 220 : 400
  const nBanners = banners.length

  const goBanner = useCallback(
    (delta: number) => {
      if (nBanners <= 0) return
      setBannerIndex((i) => (i + delta + nBanners) % nBanners)
    },
    [nBanners]
  )

  useEffect(() => {
    setBannerIndex(0)
  }, [nBanners])

  useEffect(() => {
    if (nBanners <= 1 || bannerPauseAuto) return
    const id = window.setInterval(() => {
      setBannerIndex((i) => (i + 1) % nBanners)
    }, BANNER_AUTO_MS)
    return () => clearInterval(id)
  }, [nBanners, bannerPauseAuto])

  useEffect(() => {
    const loadHome = async () => {
      setLoading(true)
      setError('')
      try {
        const [bannersRes, categoriesRes, productsRes] = await Promise.all([
          api.get('/banners'),
          api.get('/categories'),
          api.get('/products', { params: { limit: HOT_FETCH_LIMIT, page: 1 } }),
        ])
        setBanners(unwrapData<any[]>(bannersRes.data, []).map(mapBanner))
        setCategories(unwrapData<any[]>(categoriesRes.data, []).map(mapCategory))
        const mapped = unwrapData<any[]>(productsRes.data, []).map(mapProduct)
        setProducts(mapped.slice(0, 8))
        setHotPoolProducts(mapped)
      } catch {
        setError('Không thể tải dữ liệu trang chủ. Vui lòng thử lại.')
      } finally {
        setLoading(false)
      }
    }
    loadHome()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Đang tải dữ liệu trang chủ...</div>
  if (error) return <div style={{ padding: 24, color: '#dc2626' }}>{error}</div>

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      {/* Hero Banner — carousel tự chạy + nút trái/phải */}
      <section style={{ 
        marginBottom: isMobile ? 40 : 64, 
        borderRadius: isMobile ? 12 : 20, 
        overflow: 'hidden', 
        background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
        border: '2px solid #E2A227',
        boxShadow: '0 8px 24px rgba(226, 162, 39, 0.15)',
        minHeight: isMobile ? 260 : 400,
        position: 'relative'
      }}>
        {banners.length > 0 ? (
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setBannerPauseAuto(true)}
            onMouseLeave={() => setBannerPauseAuto(false)}
          >
            <div style={{ overflow: 'hidden', width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  width: `${nBanners * 100}%`,
                  transform: `translateX(-${(bannerIndex * 100) / nBanners}%)`,
                  transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {banners.map((b) => {
                  const href = b.linkUrl || (b.productId ? `/products/${b.productId}` : '#')
                  const external = /^https?:\/\//i.test(href)
                  const img = (
                    <img
                      src={b.imageUrl}
                      alt=""
                      style={{ width: '100%', height: bannerHeight, objectFit: 'cover', display: 'block' }}
                    />
                  )
                  return (
                    <div
                      key={b.id}
                      style={{
                        flex: `0 0 ${100 / nBanners}%`,
                        width: `${100 / nBanners}%`,
                        maxWidth: `${100 / nBanners}%`,
                      }}
                    >
                      {external ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', lineHeight: 0 }}>
                          {img}
                        </a>
                      ) : href !== '#' ? (
                        <Link to={href} style={{ display: 'block', lineHeight: 0 }}>
                          {img}
                        </Link>
                      ) : (
                        <div style={{ display: 'block', lineHeight: 0 }}>{img}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {nBanners > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Banner trước"
                  onClick={() => goBanner(-1)}
                  style={{
                    position: 'absolute',
                    left: isMobile ? 8 : 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    width: isMobile ? 40 : 48,
                    height: isMobile ? 40 : 48,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.9)',
                    background: 'rgba(45, 68, 33, 0.55)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  <FiChevronLeft size={isMobile ? 22 : 26} />
                </button>
                <button
                  type="button"
                  aria-label="Banner sau"
                  onClick={() => goBanner(1)}
                  style={{
                    position: 'absolute',
                    right: isMobile ? 8 : 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    width: isMobile ? 40 : 48,
                    height: isMobile ? 40 : 48,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.9)',
                    background: 'rgba(45, 68, 33, 0.55)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  <FiChevronRight size={isMobile ? 22 : 26} />
                </button>
                <div
                  role="tablist"
                  aria-label="Chọn banner"
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 8,
                    zIndex: 2,
                  }}
                >
                  {banners.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      aria-label={`Banner ${i + 1}`}
                      aria-current={i === bannerIndex ? 'true' : undefined}
                      onClick={() => setBannerIndex(i)}
                      style={{
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer',
                        width: i === bannerIndex ? 22 : 8,
                        height: 8,
                        borderRadius: 4,
                        background: i === bannerIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        transition: 'width 0.25s ease, background 0.25s ease',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ 
            height: 400, 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 16
          }}>
            <div style={{ fontSize: 72, display: 'flex', color: '#3C5C2D' }}><FiFeather /></div>
            <h2 style={{ color: '#3C5C2D', fontSize: 36, fontWeight: 700, margin: 0 }}>Nông sản hữu cơ tươi ngon</h2>
            <p style={{ color: '#737373', fontSize: 18 }}>Từ trang trại đến bàn ăn của bạn</p>
          </div>
        )}
      </section>

      {/* Categories */}
      <section style={{ marginBottom: isMobile ? 40 : 64 }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 40 }}>
          <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, color: '#3C5C2D', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
            Danh mục nổi bật
          </h2>
          <div style={{ width: 80, height: 4, background: 'linear-gradient(90deg, #E2A227 0%, #3C5C2D 100%)', margin: '0 auto', borderRadius: 2 }}></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 16 : 24 }}>
          {categories.length > 0 ? (
            categories.map((c) => (
              <Link 
                key={c.id} 
                to={`/products?category=${c.id}`} 
                style={{ 
                  textAlign: 'center', 
                  padding: 32, 
                  background: '#fff',
                  border: '2px solid #e7e5e4',
                  borderRadius: 16, 
                  textDecoration: 'none', 
                  color: '#1a1a1a',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 12, display: 'flex', justifyContent: 'center', color: '#3C5C2D' }}><FiFeather /></div>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</span>
              </Link>
            ))
          ) : (
            <>
              {['Trái cây sấy, mứt', 'Bánh mứt, đồ khô', 'Trà, cà phê', 'Nông sản, dược liệu'].map((n, i) => (
                <div key={i} style={{ 
                  textAlign: 'center', 
                  padding: 32, 
                  background: '#fff',
                  border: '2px solid #e7e5e4',
                  borderRadius: 16,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}>
                  <div style={{ fontSize: 48, marginBottom: 12, display: 'flex', justifyContent: 'center', color: '#3C5C2D' }}><FiFeather /></div>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{n}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* Sản phẩm hot theo ngày — 4 ô/lượt, nút trái/phải, tự chuyển 1s */}
      {hotPages.length > 0 && (
        <section style={{ marginBottom: isMobile ? 40 : 64 }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 28 }}>
            <h2
              style={{
                fontSize: isMobile ? 22 : 30,
                fontWeight: 700,
                color: '#3C5C2D',
                margin: '0 0 8px',
                letterSpacing: '-0.5px',
              }}
            >
              Sản phẩm hot hôm nay
            </h2>
          
            <div
              style={{
                width: 80,
                height: 4,
                background: 'linear-gradient(90deg, #E2A227 0%, #3C5C2D 100%)',
                margin: '12px auto 0',
                borderRadius: 2,
              }}
            />
          </div>

          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setHotPauseAuto(true)}
            onMouseLeave={() => setHotPauseAuto(false)}
          >
            <div
              style={{
                overflow: 'hidden',
                width: '100%',
                borderRadius: 16,
                border: '2px solid #e7e5e4',
                background: '#fff',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: `${nHotPages * 100}%`,
                  transform: `translateX(-${(hotSlideIndex * 100) / nHotPages}%)`,
                  transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {hotPages.map((page, pi) => (
                  <div
                    key={pi}
                    style={{
                      flex: `0 0 ${100 / nHotPages}%`,
                      width: `${100 / nHotPages}%`,
                      maxWidth: `${100 / nHotPages}%`,
                      boxSizing: 'border-box',
                      padding: isMobile ? '12px 10px' : '20px 24px',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${hotPerSlide}, minmax(0, 1fr))`,
                        gap: isMobile ? 8 : 16,
                        alignItems: 'stretch',
                      }}
                    >
                      {page.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            border: '1px solid #e7e5e4',
                            borderRadius: 12,
                            overflow: 'hidden',
                            background: '#fafaf9',
                            minWidth: 0,
                          }}
                        >
                          <div style={{ position: 'relative' }}>
                            <Link to={`/products/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                              <div
                                style={{
                                  aspectRatio: '1 / 1',
                                  background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
                                  position: 'relative',
                                }}
                              >
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: isMobile ? 36 : 44,
                                      color: '#3C5C2D',
                                    }}
                                  >
                                    <FiShoppingBag />
                                  </div>
                                )}
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    background: '#E2A227',
                                    color: '#fff',
                                    padding: '4px 8px',
                                    borderRadius: 12,
                                    fontSize: isMobile ? 10 : 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  HOT
                                </div>
                              </div>
                            </Link>
                            <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                              <WishlistHeartButton productId={p.id} />
                            </div>
                          </div>
                          <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                            <div style={{ padding: isMobile ? '8px 8px 10px' : '12px 12px 14px' }}>
                              <h3
                                style={{
                                  margin: '0 0 6px',
                                  fontSize: isMobile ? 12 : 14,
                                  fontWeight: 600,
                                  color: '#1a1a1a',
                                  lineHeight: 1.3,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical' as const,
                                  overflow: 'hidden',
                                }}
                              >
                                {p.name}
                              </h3>
                              <p style={{ margin: 0, fontWeight: 700, color: '#E2A227', fontSize: isMobile ? 13 : 15 }}>
                                {p.price?.toLocaleString()}đ
                              </p>
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {nHotPages > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Nhóm sản phẩm hot trước"
                  onClick={() => goHotSlide(-1)}
                  style={{
                    position: 'absolute',
                    left: isMobile ? 4 : 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    width: isMobile ? 36 : 44,
                    height: isMobile ? 36 : 44,
                    borderRadius: '50%',
                    border: '2px solid #e7e5e4',
                    background: 'rgba(255,255,255,0.95)',
                    color: '#3C5C2D',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                  }}
                >
                  <FiChevronLeft size={isMobile ? 20 : 24} />
                </button>
                <button
                  type="button"
                  aria-label="Nhóm sản phẩm hot sau"
                  onClick={() => goHotSlide(1)}
                  style={{
                    position: 'absolute',
                    right: isMobile ? 4 : 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    width: isMobile ? 36 : 44,
                    height: isMobile ? 36 : 44,
                    borderRadius: '50%',
                    border: '2px solid #e7e5e4',
                    background: 'rgba(255,255,255,0.95)',
                    color: '#3C5C2D',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                  }}
                >
                  <FiChevronRight size={isMobile ? 20 : 24} />
                </button>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  {hotPages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Nhóm ${i + 1}`}
                      aria-current={i === hotSlideIndex ? 'true' : undefined}
                      onClick={() => setHotSlideIndex(i)}
                      style={{
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer',
                        width: i === hotSlideIndex ? 18 : 7,
                        height: 7,
                        borderRadius: 4,
                        background: i === hotSlideIndex ? '#3C5C2D' : '#d6d3d1',
                        transition: 'width 0.2s ease, background 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section style={{ marginBottom: isMobile ? 40 : 64 }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 40 }}>
          <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, color: '#3C5C2D', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
            Sản phẩm nổi bật
          </h2>
          <div style={{ width: 80, height: 4, background: 'linear-gradient(90deg, #E2A227 0%, #3C5C2D 100%)', margin: '0 auto', borderRadius: 2 }}></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: isMobile ? 20 : 28 }}>
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
              }}
            >
              <div style={{ position: 'relative' }}>
                <Link to={`/products/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ aspectRatio: '4/3', background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)', position: 'relative' }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: '#3C5C2D' }}>
                        <FiShoppingBag />
                      </div>
                    )}
                    <div style={{ 
                      position: 'absolute', 
                      top: 12, 
                      right: 12, 
                      background: '#E2A227', 
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(226, 162, 39, 0.4)'
                    }}>
                      HOT
                    </div>
                  </div>
                </Link>
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 3 }}>
                  <WishlistHeartButton productId={p.id} />
                </div>
              </div>
              <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ padding: 20 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{p.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#E2A227', fontSize: 20 }}>
                      {p.price?.toLocaleString()}đ
                    </p>
                    <div style={{ 
                      background: '#3C5C2D',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600
                    }}>
                      Mua ngay
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', 
        gap: isMobile ? 20 : 28, 
        marginTop: isMobile ? 40 : 64,
        padding: isMobile ? '32px 0' : '48px 0'
      }}>
        <div style={{ 
          padding: 32, 
          background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
          border: '2px solid #E2A227',
          borderRadius: 16, 
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(226, 162, 39, 0.1)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><FiTruck /></div>
          <h3 style={{ margin: '0 0 12px', color: '#3C5C2D', fontSize: 20, fontWeight: 700 }}>Miễn phí vận chuyển</h3>
          <p style={{ margin: 0, color: '#737373', fontSize: 15 }}>Đơn hàng từ 300.000đ</p>
        </div>
        <div style={{ 
          padding: 32, 
          background: 'linear-gradient(135deg, #f0f9f4 0%, #e6f4ea 100%)',
          border: '2px solid #3C5C2D',
          borderRadius: 16, 
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(60, 92, 45, 0.1)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><FiFeather /></div>
          <h3 style={{ margin: '0 0 12px', color: '#3C5C2D', fontSize: 20, fontWeight: 700 }}>100% Hữu cơ</h3>
          <p style={{ margin: 0, color: '#737373', fontSize: 15 }}>Từ trang trại đến bàn ăn</p>
        </div>
        <div style={{ 
          padding: 32, 
          background: 'linear-gradient(135deg, #fffbf0 0%, #fff5e1 100%)',
          border: '2px solid #E2A227',
          borderRadius: 16, 
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(226, 162, 39, 0.1)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><FiCheckCircle /></div>
          <h3 style={{ margin: '0 0 12px', color: '#3C5C2D', fontSize: 20, fontWeight: 700 }}>Chứng nhận VietGAP</h3>
          <p style={{ margin: 0, color: '#737373', fontSize: 15 }}>Sản phẩm đạt tiêu chuẩn chất lượng cao</p>
        </div>
      </section>
    </div>
  )
}
