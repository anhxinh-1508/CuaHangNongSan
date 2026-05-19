import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiGift, FiPlus, FiTrash2 } from 'react-icons/fi'
import api from '../../api/client'
import { unwrapList, type UiAdminCoupon, mapAdminCoupon } from '../../api/mappers'
import PageHeader from '../../components/admin/PageHeader'
import Card from '../../components/admin/Card'
import Table from '../../components/admin/Table'
import Modal from '../../components/admin/Modal'
import Button from '../../components/admin/Button'
import Input from '../../components/admin/Input'
import Select from '../../components/admin/Select'
import Badge from '../../components/admin/Badge'
import AdminListToolbar from '../../components/admin/AdminListToolbar'
import AdminPagination from '../../components/admin/AdminPagination'
import { defaultSortDirection, sortRows, textMatches, timeOrZero } from '../../utils/adminGridHelpers'
import { useAdminListPage } from '../../hooks/useAdminListPage'

type FormData = {
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: string
  minOrderValue: string
  startAt: string
  endAt: string
  usageLimit: string
  perUserLimit: string
  isActive: boolean
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<UiAdminCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'yes' | 'no'>('all')
  const [sortColumn, setSortColumn] = useState<string>('endAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    code: '',
    discountType: 'PERCENT',
    discountValue: '',
    minOrderValue: '0',
    startAt: '',
    endAt: '',
    usageLimit: '100',
    perUserLimit: '2',
    isActive: true
  })

  const fetchCoupons = async () => {
    try {
      const res = await api.get('/admin/coupons')
      setCoupons(unwrapList(res.data).map(mapAdminCoupon))
    } catch {
      alert('Không thể tải danh sách mã giảm giá')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  const onSortColumn = useCallback(
    (key: string) => {
      if (sortColumn === key) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setSortColumn(key)
        setSortDirection(defaultSortDirection(key))
      }
    },
    [sortColumn]
  )

  const sortAccessors = useMemo(
    () => ({
      code: (c: UiAdminCoupon) => c.code.toLowerCase(),
      discountValue: (c: UiAdminCoupon) => c.discountValue,
      minOrderValue: (c: UiAdminCoupon) => c.minOrderValue,
      usage: (c: UiAdminCoupon) => c.usedCount / Math.max(c.usageLimit, 1),
      startAt: (c: UiAdminCoupon) => timeOrZero(c.startAt),
      endAt: (c: UiAdminCoupon) => timeOrZero(c.endAt),
      isActive: (c: UiAdminCoupon) => (c.isActive ? 1 : 0),
    }),
    []
  )

  const displayedCoupons = useMemo(() => {
    let list = coupons.filter((c) => {
      if (!textMatches(searchQuery, c.code)) return false
      if (filterActive === 'yes' && !c.isActive) return false
      if (filterActive === 'no' && c.isActive) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [coupons, searchQuery, filterActive, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedCoupons, [searchQuery, filterActive])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      code: '',
      discountType: 'PERCENT',
      discountValue: '',
      minOrderValue: '0',
      startAt: '',
      endAt: '',
      usageLimit: '100',
      perUserLimit: '2',
      isActive: true
    })
    setIsModalOpen(true)
  }

  const openEditModal = (id: string) => {
    const coupon = coupons.find(c => c.id === id)
    if (!coupon) return
    
    setEditingId(id)
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minOrderValue: String(coupon.minOrderValue),
      startAt: coupon.startAt.split('T')[0],
      endAt: coupon.endAt.split('T')[0],
      usageLimit: String(coupon.usageLimit),
      perUserLimit: String(coupon.perUserLimit),
      isActive: coupon.isActive
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    try {
      const payload = {
        code: formData.code.toUpperCase(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue),
        startAt: new Date(formData.startAt).toISOString(),
        endAt: new Date(formData.endAt).toISOString(),
        usageLimit: Number(formData.usageLimit),
        perUserLimit: Number(formData.perUserLimit),
        isActive: formData.isActive
      }

      if (editingId) {
        await api.put(`/admin/coupons/${editingId}`, payload)
        alert('Cập nhật mã giảm giá thành công')
      } else {
        await api.post('/admin/coupons', payload)
        alert('Tạo mã giảm giá thành công')
      }

      setIsModalOpen(false)
      fetchCoupons()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa mã giảm giá này?')) return
    
    try {
      await api.delete(`/admin/coupons/${id}`)
      alert('Xóa mã giảm giá thành công')
      fetchCoupons()
    } catch {
      alert('Không thể xóa mã giảm giá')
    }
  }

  const columns = [
    { 
      key: 'code', 
      title: 'Mã',
      sortable: true,
      render: (item: UiAdminCoupon) => (
        <span style={{ fontWeight: 700, color: 'var(--brand-green)', fontSize: 15 }}>
          {item.code}
        </span>
      )
    },
    {
      key: 'discountValue',
      title: 'Giảm giá',
      sortable: true,
      render: (item: UiAdminCoupon) => (
        <span style={{ fontWeight: 600 }}>
          {item.discountType === 'PERCENT' 
            ? `${item.discountValue}%` 
            : `${item.discountValue.toLocaleString()}đ`
          }
        </span>
      )
    },
    {
      key: 'minOrderValue',
      title: 'Đơn tối thiểu',
      sortable: true,
      render: (item: UiAdminCoupon) => `${item.minOrderValue.toLocaleString()}đ`
    },
    {
      key: 'usage',
      title: 'Sử dụng',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminCoupon) => (
        <span>
          {item.usedCount}/{item.usageLimit}
        </span>
      )
    },
    {
      key: 'startAt',
      title: 'Bắt đầu',
      sortable: true,
      render: (item: UiAdminCoupon) => new Date(item.startAt).toLocaleDateString('vi-VN')
    },
    {
      key: 'endAt',
      title: 'Kết thúc',
      sortable: true,
      render: (item: UiAdminCoupon) => new Date(item.endAt).toLocaleDateString('vi-VN')
    },
    {
      key: 'isActive',
      title: 'Trạng thái',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminCoupon) => {
        const now = new Date()
        const endDate = new Date(item.endAt)
        const isExpired = now > endDate
        const isFull = item.usedCount >= item.usageLimit
        
        if (!item.isActive) return <Badge variant="default">Tạm ngừng</Badge>
        if (isExpired) return <Badge variant="danger">Hết hạn</Badge>
        if (isFull) return <Badge variant="warning">Hết lượt</Badge>
        return <Badge variant="success">Hoạt động</Badge>
      }
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '120px',
      align: 'center' as const,
      render: (item: UiAdminCoupon) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => openEditModal(item.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-green)', fontSize: 18 }}
            title="Chỉnh sửa"
          >
            <FiEdit2 />
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}
            title="Xóa"
          >
            <FiTrash2 />
          </button>
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Quản lý Mã giảm giá"
        subtitle="Quản lý các mã khuyến mãi và giảm giá"
        icon={<FiGift />}
        actions={
          <Button onClick={openCreateModal} icon={<FiPlus />}>
            Thêm mã giảm giá
          </Button>
        }
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Mã giảm giá…"
          filteredCount={displayedCoupons.length}
          totalCount={coupons.length}
        >
          <Select
            label="Kích hoạt"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'yes', label: 'Đang bật' },
              { value: 'no', label: 'Đang tắt' },
            ]}
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'yes' | 'no')}
            containerStyle={{ marginBottom: 0, minWidth: 0, width: '100%' }}
          />
        </AdminListToolbar>
        <Table
          columns={columns}
          data={listPage.pagedItems}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Chưa có mã giảm giá nào"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortColumn={onSortColumn}
        />
        <AdminPagination
          page={listPage.page}
          pageSize={listPage.pageSize}
          totalItems={listPage.totalItems}
          onPageChange={listPage.setPage}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Chỉnh sửa mã giảm giá' : 'Thêm mã giảm giá mới'}
        width={700}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Mã giảm giá"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            required
            placeholder="VD: SUMMER2026"
            helperText="Chỉ sử dụng chữ cái, số và gạch dưới"
          />

          <div className="admin-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Select
              label="Loại giảm giá"
              value={formData.discountType}
              onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'PERCENT' | 'FIXED' })}
              options={[
                { value: 'PERCENT', label: 'Phần trăm (%)' },
                { value: 'FIXED', label: 'Số tiền cố định (đ)' }
              ]}
              required
            />
            <Input
              label={formData.discountType === 'PERCENT' ? 'Giá trị (%)' : 'Giá trị (đ)'}
              type="number"
              value={formData.discountValue}
              onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
              required
              min="0"
              max={formData.discountType === 'PERCENT' ? '100' : undefined}
            />
          </div>

          <Input
            label="Giá trị đơn hàng tối thiểu (đ)"
            type="number"
            value={formData.minOrderValue}
            onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
            required
            min="0"
          />

          <div className="admin-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input
              label="Ngày bắt đầu"
              type="date"
              value={formData.startAt}
              onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
              required
            />
            <Input
              label="Ngày kết thúc"
              type="date"
              value={formData.endAt}
              onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
              required
            />
          </div>

          <div className="admin-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input
              label="Tổng số lượt sử dụng"
              type="number"
              value={formData.usageLimit}
              onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
              required
              min="1"
            />
            <Input
              label="Số lượt/người dùng"
              type="number"
              value={formData.perUserLimit}
              onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
              required
              min="1"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Kích hoạt mã giảm giá</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
