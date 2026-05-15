import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiBox, FiEdit2, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi'
import api from '../../api/client'
import { unwrapList, type UiAdminBatch, type UiAdminProduct, mapAdminBatch, mapAdminProduct } from '../../api/mappers'
import PageHeader from '../../components/admin/PageHeader'
import Card from '../../components/admin/Card'
import Table from '../../components/admin/Table'
import Modal from '../../components/admin/Modal'
import Button from '../../components/admin/Button'
import Input from '../../components/admin/Input'
import Select from '../../components/admin/Select'
import Textarea from '../../components/admin/Textarea'
import Badge from '../../components/admin/Badge'
import AdminListToolbar from '../../components/admin/AdminListToolbar'
import AdminPagination from '../../components/admin/AdminPagination'
import { defaultSortDirection, sortRows, textMatches, timeOrZero } from '../../utils/adminGridHelpers'
import { useAdminListPage } from '../../hooks/useAdminListPage'

const BATCH_STATUS_FILTER = [
  { value: '', label: 'Tất cả trạng thái lô' },
  { value: 'Active', label: 'Hoạt động' },
  { value: 'NearExpiry', label: 'Cận hạn' },
  { value: 'Expired', label: 'Hết hạn' },
  { value: 'OutOfStock', label: 'Hết hàng' },
]

type FormData = {
  productId: string
  batchCode: string
  harvestDate: string
  packingDate: string
  expiryDate: string
  quantityInStock: string
  importPrice: string
  notes: string
}

export default function AdminBatches() {
  const [batches, setBatches] = useState<UiAdminBatch[]>([])
  const [products, setProducts] = useState<UiAdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProductId, setFilterProductId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    productId: '',
    batchCode: '',
    harvestDate: '',
    packingDate: '',
    expiryDate: '',
    quantityInStock: '',
    importPrice: '',
    notes: ''
  })

  const fetchBatches = async () => {
    try {
      const res = await api.get('/admin/batches')
      setBatches(unwrapList(res.data).map(mapAdminBatch))
    } catch {
      alert('Không thể tải danh sách lô hàng')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await api.get('/admin/products')
      setProducts(unwrapList(res.data).map(mapAdminProduct))
    } catch {
      console.error('Không thể tải sản phẩm')
    }
  }

  useEffect(() => {
    fetchBatches()
    fetchProducts()
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
      batchCode: (b: UiAdminBatch) => b.batchCode.toLowerCase(),
      productName: (b: UiAdminBatch) => (b.productName ?? '').toLowerCase(),
      expiryDate: (b: UiAdminBatch) => timeOrZero(b.expiryDate),
      quantityInStock: (b: UiAdminBatch) => b.quantityInStock,
      importPrice: (b: UiAdminBatch) => b.importPrice,
      status: (b: UiAdminBatch) => b.status,
      isDisabled: (b: UiAdminBatch) => (b.isDisabled ? 1 : 0),
      createdAt: (b: UiAdminBatch) => timeOrZero(b.createdAt),
    }),
    []
  )

  const displayedBatches = useMemo(() => {
    let list = batches.filter((b) => {
      if (!textMatches(searchQuery, b.batchCode, b.productName, b.notes)) return false
      if (filterProductId && b.productId !== filterProductId) return false
      if (filterStatus && b.status !== filterStatus) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [batches, searchQuery, filterProductId, filterStatus, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedBatches, [searchQuery, filterProductId, filterStatus])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      productId: products[0]?.id || '',
      batchCode: '',
      harvestDate: '',
      packingDate: '',
      expiryDate: '',
      quantityInStock: '',
      importPrice: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  const openEditModal = (id: string) => {
    const batch = batches.find(b => b.id === id)
    if (!batch) return
    
    setEditingId(id)
    setFormData({
      productId: batch.productId,
      batchCode: batch.batchCode,
      harvestDate: batch.harvestDate.split('T')[0],
      packingDate: batch.packingDate.split('T')[0],
      expiryDate: batch.expiryDate.split('T')[0],
      quantityInStock: String(batch.quantityInStock),
      importPrice: String(batch.importPrice),
      notes: batch.notes
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const payload = {
        productId: formData.productId,
        batchCode: formData.batchCode,
        harvestDate: formData.harvestDate,
        packingDate: formData.packingDate,
        expiryDate: formData.expiryDate,
        quantityInStock: Number(formData.quantityInStock),
        importPrice: Number(formData.importPrice),
        notes: formData.notes
      }

      if (editingId) {
        await api.put(`/admin/batches/${editingId}`, payload)
        alert('Cập nhật lô hàng thành công')
      } else {
        await api.post('/admin/batches', payload)
        alert('Tạo lô hàng thành công')
      }

      setIsModalOpen(false)
      fetchBatches()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa lô hàng này?')) return
    
    try {
      await api.delete(`/admin/batches/${id}`)
      alert('Xóa lô hàng thành công')
      fetchBatches()
    } catch {
      alert('Không thể xóa lô hàng')
    }
  }

  const handleToggleDisabled = async (id: string) => {
    try {
      await api.patch(`/admin/batches/${id}/toggle-disabled`)
      fetchBatches()
    } catch {
      alert('Không thể thay đổi trạng thái')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default', label: string }> = {
      'Active': { variant: 'success', label: 'Hoạt động' },
      'NearExpiry': { variant: 'warning', label: 'Cận hạn' },
      'Expired': { variant: 'danger', label: 'Hết hạn' },
      'OutOfStock': { variant: 'default', label: 'Hết hàng' }
    }
    const config = statusMap[status] || { variant: 'default' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const columns = [
    { key: 'batchCode', title: 'Mã lô', sortable: true },
    { 
      key: 'productName', 
      title: 'Sản phẩm',
      sortable: true,
      render: (item: UiAdminBatch) => item.productName || '-'
    },
    {
      key: 'expiryDate',
      title: 'Hạn sử dụng',
      sortable: true,
      render: (item: UiAdminBatch) => new Date(item.expiryDate).toLocaleDateString('vi-VN')
    },
    {
      key: 'quantityInStock',
      title: 'Tồn kho',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminBatch) => (
        <Badge variant={item.quantityInStock > 0 ? 'success' : 'danger'}>
          {item.quantityInStock}
        </Badge>
      )
    },
    {
      key: 'importPrice',
      title: 'Giá nhập',
      sortable: true,
      render: (item: UiAdminBatch) => `${item.importPrice.toLocaleString()}đ`
    },
    {
      key: 'status',
      title: 'Trạng thái',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminBatch) => getStatusBadge(item.status)
    },
    {
      key: 'isDisabled',
      title: 'Kích hoạt',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminBatch) => (
        <Badge variant={item.isDisabled ? 'danger' : 'success'}>
          {item.isDisabled ? 'Tắt' : 'Bật'}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      title: 'Ngày tạo',
      sortable: true,
      render: (item: UiAdminBatch) =>
        item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—',
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '150px',
      align: 'center' as const,
      render: (item: UiAdminBatch) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => handleToggleDisabled(item.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.isDisabled ? '#16a34a' : '#737373', fontSize: 20 }}
            title={item.isDisabled ? 'Bật' : 'Tắt'}
          >
            {item.isDisabled ? <FiToggleLeft /> : <FiToggleRight />}
          </button>
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
        title="Quản lý Lô hàng"
        subtitle="Quản lý các lô hàng nhập kho"
        icon={<FiBox />}
        actions={
          <Button onClick={openCreateModal} icon={<FiPlus />}>
            Thêm lô hàng
          </Button>
        }
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Mã lô, tên SP, ghi chú…"
          filteredCount={displayedBatches.length}
          totalCount={batches.length}
        >
          <Select
            label="Sản phẩm"
            options={[{ value: '', label: 'Tất cả sản phẩm' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
            value={filterProductId}
            onChange={(e) => setFilterProductId(e.target.value)}
            containerStyle={{ marginBottom: 0, minWidth: 220 }}
          />
          <Select
            label="Trạng thái lô"
            options={BATCH_STATUS_FILTER}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            containerStyle={{ marginBottom: 0, minWidth: 200 }}
          />
        </AdminListToolbar>
        <Table
          columns={columns}
          data={listPage.pagedItems}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Chưa có lô hàng nào"
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
        title={editingId ? 'Chỉnh sửa lô hàng' : 'Thêm lô hàng mới'}
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
          <Select
            label="Sản phẩm"
            value={formData.productId}
            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
            options={products.map(p => ({ value: p.id, label: p.name }))}
            required
          />

          <Input
            label="Mã lô"
            value={formData.batchCode}
            onChange={(e) => setFormData({ ...formData, batchCode: e.target.value })}
            required
            placeholder="VD: LOT-2026-001"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Input
              label="Ngày thu hoạch"
              type="date"
              value={formData.harvestDate}
              onChange={(e) => setFormData({ ...formData, harvestDate: e.target.value })}
              required
            />
            <Input
              label="Ngày đóng gói"
              type="date"
              value={formData.packingDate}
              onChange={(e) => setFormData({ ...formData, packingDate: e.target.value })}
              required
            />
            <Input
              label="Hạn sử dụng"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input
              label="Số lượng tồn kho"
              type="number"
              value={formData.quantityInStock}
              onChange={(e) => setFormData({ ...formData, quantityInStock: e.target.value })}
              required
              min="0"
            />
            <Input
              label="Giá nhập (đ)"
              type="number"
              value={formData.importPrice}
              onChange={(e) => setFormData({ ...formData, importPrice: e.target.value })}
              required
              min="0"
            />
          </div>

          <Textarea
            label="Ghi chú"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Ghi chú về lô hàng (tùy chọn)"
          />
        </form>
      </Modal>
    </div>
  )
}
