import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FiAlertTriangle, FiBarChart2, FiClock, FiDollarSign, FiLayers, FiPieChart, FiShoppingBag, FiTrendingUp } from 'react-icons/fi'
import api from '../../api/client'
import { mapAdminReports, unwrapData, type UiAdminReports } from '../../api/mappers'
import PageHeader from '../../components/admin/PageHeader'
import Card from '../../components/admin/Card'
import Button from '../../components/admin/Button'
import Select from '../../components/admin/Select'
import Input from '../../components/admin/Input'
import Table from '../../components/admin/Table'

const RANGE_OPTIONS = [
  { value: '7d', label: '7 ngày gần nhất' },
  { value: '30d', label: '30 ngày gần nhất' },
  { value: '90d', label: '90 ngày' },
  { value: '365d', label: '12 tháng' },
  { value: 'all', label: 'Tối đa ~10 năm' },
]

function vnd(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`
}

function fmtDateKey(key: string) {
  const [y, m, d] = key.split('-')
  if (!y || !m || !d) return key
  return `${d}/${m}/${y}`
}

function maxInSeries(rows: { value: number }[]) {
  return rows.reduce((m, r) => Math.max(m, r.value), 0)
}

function HorizontalBars({
  rows,
  valueLabel,
}: {
  rows: { key: string; value: number; color?: string }[]
  valueLabel: (v: number) => string
}) {
  const max = maxInSeries(rows.map((r) => ({ value: r.value })))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => {
        const pctWidth = max > 0 ? Math.min(100, Math.round((r.value / max) * 100)) : 0
        return (
          <div key={r.key}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 4,
                fontSize: 13,
                gap: 8,
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.key}</span>
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{valueLabel(r.value)}</span>
            </div>
            <div style={{ height: 10, background: '#e7e5e4', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pctWidth}%`,
                  height: '100%',
                  borderRadius: 6,
                  background: r.color ?? 'linear-gradient(90deg, #3C5C2D 0%, #5a8a42 100%)',
                  minWidth: r.value > 0 ? 4 : 0,
                  transition: 'width 0.35s ease',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryTile({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div
      style={{
        padding: 22,
        background: '#fff',
        border: '2px solid #e7e5e4',
        borderRadius: 14,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ margin: 0, color: '#737373', fontSize: 13, fontWeight: 600 }}>{title}</p>
        <span style={{ fontSize: 22, display: 'flex', opacity: 0.9, color: '#737373' }}>{icon}</span>
      </div>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1c1917', lineHeight: 1.25 }}>{value}</p>
    </div>
  )
}

/** Tách nhãn dd/mm/yyyy → hai dòng dễ đọc. */
function splitChartDateLabel(label: string): { line1: string; line2: string } {
  const parts = label.split('/').map((s) => s.trim())
  if (parts.length === 3 && parts.every(Boolean)) {
    return { line1: `${parts[0]}/${parts[1]}`, line2: parts[2] }
  }
  return { line1: label, line2: '' }
}

/** Biểu đồ cột doanh thu theo ngày — co giãn theo khung; màu đơn (không gradient). */
function RevenueColumnChart({ points }: { points: { label: string; revenue: number }[] }) {
  if (!points.length) {
    return <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Chưa có dữ liệu để vẽ biểu đồ.</p>
  }

  const revenues = points.map((p) => p.revenue)
  const maxR = Math.max(...revenues, 1)
  let maxIdx = 0
  let minIdx = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i].revenue > points[maxIdx].revenue) maxIdx = i
    if (points[i].revenue < points[minIdx].revenue) minIdx = i
  }
  const sameAll = revenues.length > 0 && revenues.every((v) => v === revenues[0])

  const chartH = 200
  const yLabels = [maxR, Math.round(maxR / 2), 0]

  const barBackground = (i: number) => {
    if (sameAll) return '#E2A227'
    if (i === maxIdx) return '#E2A227'
    if (i === minIdx && maxIdx !== minIdx) return '#0ea5e9'
    return '#3C5C2D'
  }

  return (
    <div
      style={{
        width: '100%',
        background: '#fafafa',
        borderRadius: 0,
        border: '1px solid #e7e5e4',
        padding: '12px 12px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'stretch' }}>
        <div
          style={{
            width: 48,
            flexShrink: 0,
            alignSelf: 'flex-start',
            height: chartH,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingBottom: 0,
            fontSize: 11,
            color: '#737373',
            textAlign: 'right',
          }}
          aria-hidden
        >
          {yLabels.map((v) => (
            <span key={v}>{v.toLocaleString('vi-VN')}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              height: chartH,
              borderLeft: '1px solid #57534e',
              borderBottom: '1px solid #57534e',
              paddingLeft: 8,
              paddingBottom: 0,
            }}
            role="img"
            aria-label="Biểu đồ cột doanh thu theo ngày"
          >
            {points.map((p, i) => {
              const rawPct = (p.revenue / maxR) * 100
              const hPct = p.revenue > 0 ? Math.max(rawPct, 6) : 0
              return (
                <div
                  key={`${p.label}-${i}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                  title={`${p.label}: ${vnd(p.revenue)}`}
                >
                  <div
                    style={{
                      width: 'min(72%, 32px)',
                      height: `${hPct}%`,
                      minHeight: p.revenue > 0 ? 6 : 0,
                      borderRadius: 0,
                      background: barBackground(i),
                      transition: 'height 0.35s ease',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div
            style={{
              display: 'flex',
              width: '100%',
              gap: 4,
              paddingLeft: 8,
              paddingTop: 10,
              minHeight: 44,
            }}
          >
            {points.map((p, i) => {
              const { line1, line2 } = splitChartDateLabel(p.label)
              return (
                <div
                  key={`lab-${p.label}-${i}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'center',
                    padding: '0 2px',
                  }}
                  title={`${p.label}: ${vnd(p.revenue)}`}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1c1917', lineHeight: 1.25 }}>{line1}</div>
                  {line2 ? <div style={{ fontSize: 12, color: '#57534e', marginTop: 2, lineHeight: 1.2 }}>{line2}</div> : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11, color: '#57534e', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 0,
              background: '#E2A227',
            }}
          />{' '}
          Ngày cao nhất
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 0,
              background: '#0ea5e9',
            }}
          />{' '}
          Ngày thấp nhất
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 0,
              background: '#3C5C2D',
            }}
          />{' '}
          Các ngày khác
        </span>
      </div>
    </div>
  )
}

export default function AdminReports() {
  const [range, setRange] = useState('30d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [data, setData] = useState<UiAdminReports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchReports = useCallback(async () => {
    if (useCustomRange && from && to && from.slice(0, 10) > to.slice(0, 10)) {
      setError('Đến ngày không được nhỏ hơn Từ ngày.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (useCustomRange && from) params.set('from', from.slice(0, 10))
      if (useCustomRange && to) params.set('to', to.slice(0, 10))
      if (!useCustomRange || (!from && !to)) params.set('range', range)
      const qs = params.toString()
      const res = await api.get(`/admin/reports${qs ? `?${qs}` : ''}`)
      setData(mapAdminReports(unwrapData<any>(res.data, {})))
    } catch {
      setError('Không thể tải báo cáo. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [range, from, to, useCustomRange])

  useEffect(() => {
    void fetchReports()
  }, [fetchReports])

  const series = useMemo(() => {
    if (!data) return []
    const mapOrders: Record<string, number> = {}
    for (const row of data.ordersTimeline) mapOrders[row.date] = row.count
    return data.revenueTimeline.map((r) => ({
      date: r.date,
      label: fmtDateKey(r.date),
      revenue: r.revenue,
      orders: mapOrders[r.date] || 0,
      netSales: r.netSales,
      cogs: r.cogs,
      grossProfit: r.grossProfit,
    }))
  }, [data])

  const insightColumnPoints = useMemo(
    () => series.slice(-30).map((s) => ({ label: s.label, revenue: s.revenue })),
    [series]
  )

  const bestDay = useMemo(() => {
    if (!series.length) return null
    return [...series].sort((a, b) => b.revenue - a.revenue)[0]
  }, [series])
  const lowestDay = useMemo(() => {
    if (!series.length) return null
    return [...series].sort((a, b) => a.revenue - b.revenue)[0]
  }, [series])

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Báo cáo & thống kê" subtitle="Doanh thu, vốn, lãi ước lượng và tồn kho" icon={<FiPieChart />} />
        <p style={{ color: '#dc2626', fontWeight: 600 }}>{error}</p>
        <Button onClick={() => void fetchReports()}>Thử lại</Button>
      </div>
    )
  }

  const s = data?.summary

  return (
    <div>
      <PageHeader
        title="Báo cáo & thống kê"
        subtitle="Doanh thu, vốn, tiền lãi ước lượng và tình hình tồn kho — trình bày gọn cho đồ án"
        icon={<FiPieChart />}
        actions={
          <Link to="/admin" style={{ fontWeight: 600, color: 'var(--brand-green)', textDecoration: 'none' }}>
            ← Tổng quan Dashboard
          </Link>
        }
      />

      <Card
        title="Bộ lọc thời gian"
        style={{ marginBottom: 24 }}
        actions={
          <Button type="button" onClick={() => void fetchReports()} disabled={loading}>
            {loading ? 'Đang tải…' : 'Làm mới'}
          </Button>
        }
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={useCustomRange}
            onChange={(e) => setUseCustomRange(e.target.checked)}
          />
          Khoảng ngày tùy chỉnh (từ — đến)
        </label>
        {useCustomRange ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
            <Input
              label="Từ ngày"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                const v = e.target.value
                setFrom(v)
                if (v && to && to < v) setTo(v)
              }}
              containerStyle={{ marginBottom: 0 }}
            />
            <Input
              label="Đến ngày"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                const v = e.target.value
                if (v && from && v < from) {
                  setTo(from)
                  return
                }
                setTo(v)
              }}
              containerStyle={{ marginBottom: 0 }}
            />
            <Button type="button" onClick={() => void fetchReports()}>
              Áp dụng
            </Button>
          </div>
        ) : (
          <Select
            label="Chọn nhanh"
            options={RANGE_OPTIONS}
            value={range}
            onChange={(e) => setRange(e.target.value)}
            containerStyle={{ marginBottom: 0, maxWidth: 360 }}
          />
        )}
        {error && data ? <p style={{ color: '#b45309', marginTop: 16, fontWeight: 600 }}>{error}</p> : null}
      </Card>

      {loading && !data ? (
        <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Đang tải báo cáo…</div>
      ) : !data || !s ? (
        <div style={{ padding: 24 }}>Không có dữ liệu.</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <SummaryTile title="Tiền bán (đơn đã giao)" value={vnd(s.totalRevenue)} icon={<FiTrendingUp />} />
            <SummaryTile title="Tiền vốn hàng đã bán" value={vnd(s.totalCogs)} icon={<FiLayers />} />
            <SummaryTile title="Tiền lãi ước lượng" value={vnd(s.grossProfit)} icon={<FiBarChart2 />} />
            <SummaryTile
              title="Đơn đã giao / tổng đơn"
              value={`${s.deliveredCount} / ${s.totalOrders}`}
              icon={<FiShoppingBag />}
            />
            <SummaryTile
              title="Giá trị hàng còn trong kho"
              value={vnd(data.inventorySummary.totalStockValue)}
              icon={<FiPieChart />}
            />
            <SummaryTile title="Lô sắp hết hạn" value={String(data.inventorySummary.nearExpiryBatches)} icon={<FiClock />} />
            <SummaryTile title="Lô đã quá hạn" value={String(data.inventorySummary.expiredBatches)} icon={<FiAlertTriangle />} />
            <SummaryTile
              title="Vốn còn ở lô quá hạn (ước)"
              value={vnd(data.inventorySummary.expiredStockValueEstimate)}
              icon={<FiDollarSign />}
            />
          </div>

          {/* <Card title="HSD: lô sắp hết hạn / quá hạn và ô tiền lãi" style={{ marginBottom: 24 }}>
            <div
              style={{
                borderLeft: '4px solid #b45309',
                paddingLeft: 16,
                marginBottom: 16,
                color: '#292524',
                fontSize: 15,
                lineHeight: 1.75,
              }}
            >
              <p style={{ margin: '0 0 12px' }}>
                Lô sắp hết hạn / quá hạn đếm số lô theo hạn sử dụng. Hàng quá hạn thường không được bán; nếu phải hủy bỏ
                thì gây lỗ thực tế — hiện báo cáo <strong>chưa tự trừ</strong> một khoản “lỗ hết hạn” vào ô tiền lãi, bạn chỉ
                cần nêu ý này trong bài làm.
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#57534e' }}>
                Hệ thống đang có <strong>{data.inventorySummary.nearExpiryBatches}</strong> lô sắp hết hạn và{' '}
                <strong>{data.inventorySummary.expiredBatches}</strong> lô quá hạn (theo trạng thái lô). Ước vốn nhập còn
                tồn trong các lô sắp hết hạn (chưa tắt): <strong>{vnd(data.inventorySummary.nearExpiryStockValueEstimate)}</strong>
                ; trong các lô quá hạn (chưa tắt): <strong>{vnd(data.inventorySummary.expiredStockValueEstimate)}</strong>{' '}
                (giá nhập × số lượng còn trong kho).
              </p>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.7, color: '#44403c' }}>
              Ô <strong>Tiền lãi ước lượng</strong> hiện là <strong>{vnd(s.grossProfit)}</strong> — tính theo đơn đã giao trong
              kỳ, <strong>không trừ</strong> khoản vốn còn kẹt ở lô quá hạn ({vnd(data.inventorySummary.expiredStockValueEstimate)}).
            </p>
            {data.inventorySummary.expiredStockValueEstimate > 0 ? (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#57534e' }}>
                Gợi ý tham khảo cho đồ án (không thay thế kế toán): nếu coi phải hủy toàn bộ hàng quá hạn còn tồn thì có thể
                minh họa “lãi sau khi trừ sơ bộ vốn quá hạn còn tồn” ≈{' '}
                <strong>{vnd(s.grossProfit - data.inventorySummary.expiredStockValueEstimate)}</strong>. Lưu ý: tiền lãi theo
                kỳ và vốn lô quá hạn là hai loại số liệu khác nhau (kỳ vs ảnh chụp tồn tại thời điểm xem).
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#57534e' }}>
                Hiện không còn số lượng trong lô quá hạn (chưa tắt), nên vốn ước ở lô quá hạn = 0đ — phần minh họa “trừ
                sơ bộ” không đổi con số ô tiền lãi.
              </p>
            )}
          </Card> */}

          <Card title="Doanh thu theo ngày (tối đa 30 ngày cuối)" style={{ marginBottom: 24 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#737373' }}>
              Di chuột vào cột để xem số tiền từng ngày. Màu vàng là ngày bán cao nhất, xanh dương là thấp nhất trong đoạn hiển thị.
            </p>
            <RevenueColumnChart points={insightColumnPoints} />
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid #e7e5e4',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 14,
              }}
            >
              <div>
                <strong>Ngày bán tốt nhất:</strong> {bestDay ? `${bestDay.label} (${vnd(bestDay.revenue)})` : '—'}
              </div>
              <div>
                <strong>Ngày bán chậm nhất:</strong> {lowestDay ? `${lowestDay.label} (${vnd(lowestDay.revenue)})` : '—'}
              </div>
            </div>
          </Card>

          {/* <Card title="Các số trên trang nghĩa là gì?" style={{ marginBottom: 24 }}>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75, fontSize: 14, color: '#44403c' }}>
              <li>
                <strong>Tiền bán</strong> là tổng tiền khách đã trả trên các đơn đã giao thành công trong khoảng thời gian bạn chọn.
              </li>
              <li>
                <strong>Tiền vốn</strong> là chi phí nhập hàng (theo lô) gắn với phần hàng đã bán ra trong kỳ — gần với “vốn thực tế đã ăn vào hàng bán”.
              </li>
              <li>
                <strong>Tiền lãi ước lượng</strong> = tiền bán trừ tiền vốn đó. Đây chưa phải lãi sau thuế hay sau mọi chi phí cửa hàng (điện, ship lỗ, hư hỏng…), chỉ phục vụ minh họa đồ án.
              </li>
              <li>
                <strong>Giá trị hàng còn trong kho</strong> ước tính theo giá nhập × số lượng còn lại của các lô đang được bán hoặc sắp hết hạn (chưa tắt).
              </li>
              <li>
                <strong>Lô sắp hết hạn / quá hạn</strong> — xem khối <strong>“HSD: lô sắp hết hạn / quá hạn và ô tiền
                lãi”</strong> ngay dưới các ô tóm tắt: có đủ đoạn giải thích và số ước vốn nhập còn tồn.
              </li>
            </ul>
          </Card> */}

          <Card title="Mặt hàng bán chạy (đơn đã giao trong kỳ)" style={{ marginBottom: 24 }}>
            <Table
              loading={false}
              columns={[
                { key: 'name', title: 'Sản phẩm' },
                {
                  key: 'quantity',
                  title: 'Đã bán (cái/kg…)',
                  align: 'right',
                  render: (r) => r.quantity.toLocaleString('vi-VN'),
                },
                {
                  key: 'revenue',
                  title: 'Tiền bán',
                  align: 'right',
                  render: (r) => vnd(r.revenue),
                },
                {
                  key: 'importCost',
                  title: 'Tiền vốn',
                  align: 'right',
                  render: (r) => vnd(r.importCost),
                },
                {
                  key: 'grossProfit',
                  title: 'Tiền lãi ước lượng',
                  align: 'right',
                  render: (r) => vnd(r.grossProfit),
                },
              ]}
              data={data.topProducts}
              keyExtractor={(r) => `${r.name}|${r.revenue}|${r.quantity}`}
              emptyText="Chưa có đơn giao trong kỳ hoặc chưa phân bổ lô."
            />
          </Card>

          <Card title="Theo dõi theo từng ngày" style={{ marginBottom: 24 }}>
            <Table
              loading={false}
              columns={[
                { key: 'label', title: 'Ngày' },
                { key: 'orders', title: 'Số đơn', align: 'right', render: (r) => r.orders.toLocaleString('vi-VN') },
                { key: 'revenue', title: 'Tiền bán', align: 'right', render: (r) => vnd(r.revenue) },
                {
                  key: 'netSales',
                  title: 'Sau giảm giá (nếu có)',
                  align: 'right',
                  render: (r) => vnd(r.netSales),
                },
                { key: 'cogs', title: 'Tiền vốn', align: 'right', render: (r) => vnd(r.cogs) },
                { key: 'grossProfit', title: 'Tiền lãi ước lượng', align: 'right', render: (r) => vnd(r.grossProfit) },
              ]}
              data={series}
              keyExtractor={(r) => r.date}
              emptyText="Không có dữ liệu ngày."
            />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24 }}>
            <Card title="Tồn kho & hạn dùng (theo lô)">
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.85, fontSize: 14 }}>
                <li>Tổng số lô: {data.inventorySummary.totalBatches}</li>
                <li>Đang bán bình thường: {data.inventorySummary.activeBatches}</li>
                <li>Sắp hết hạn: {data.inventorySummary.nearExpiryBatches} lô — vốn còn tồn ước: {vnd(data.inventorySummary.nearExpiryStockValueEstimate)}</li>
                <li>Đã quá hạn: {data.inventorySummary.expiredBatches} lô — vốn còn tồn ước: {vnd(data.inventorySummary.expiredStockValueEstimate)}</li>
                <li>Hết hàng trong kho: {data.inventorySummary.outOfStockBatches}</li>
                <li>Lô đã tắt: {data.inventorySummary.disabledBatches}</li>
                <li style={{ fontWeight: 700, marginTop: 8 }}>Giá trị tồn ước tính: {vnd(data.inventorySummary.totalStockValue)}</li>
              </ul>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                Giá trị tồn chỉ tính các lô đang bán hoặc sắp hết hạn và chưa bị tắt.
              </p>
            </Card>
            <Card title="Sản phẩm sắp hết (≤ 10 đơn vị)">
              {data.lowStockProducts.length ? (
                <HorizontalBars
                  rows={data.lowStockProducts.map((p) => ({ key: p.name, value: p.stock, color: '#b45309' }))}
                  valueLabel={(v) => `${v} đơn vị`}
                />
              ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Không có mặt hàng dưới ngưỡng.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
