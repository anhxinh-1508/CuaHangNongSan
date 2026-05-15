import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiBox, FiEdit2, FiPlus, FiTrash2, FiUpload, FiX } from 'react-icons/fi'
import api from '../../api/client'
import { mapAdminProduct, mapAdminCategory, unwrapData, unwrapList, type UiAdminProduct, type UiAdminCategory } from '../../api/mappers'
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
import { defaultSortDirection, sortRows, textMatches } from '../../utils/adminGridHelpers'
import { useAdminListPage } from '../../hooks/useAdminListPage'
import {
  VIETNAM_FOOD_CERTIFICATION_OPTIONS,
  toCanonicalCertValue,
} from '../../constants/vietnamFoodCertifications'

type FormData = {
  name: string
  slug: string
  description: string
  categoryId: string
  supplier: string
  certificationIds: string[]
  unit: string
  price: string
  salePrice: string
  isActive: boolean
  images: File[]
  existingImages: Array<{ secure_url: string; public_id: string }>
}

export default function AdminProducts() {
  const [products, setProducts] = useState<UiAdminProduct[]>([])
  const [categories, setCategories] = useState<UiAdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'yes' | 'no'>('all')
  const [sortColumn, setSortColumn] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    description: '',
    categoryId: '',
    supplier: '',
    certificationIds: [],
    unit: 'kg',
    price: '',
    salePrice: '',
    isActive: true,
    images: [],
    existingImages: []
  })

  const fetchProducts = async () => {
    try {
      const res = await api.get('/admin/products')
      setProducts(unwrapList(res.data).map(mapAdminProduct))
    } catch {
      alert('Không thể tải danh sách sản phẩm')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('/admin/categories')
      setCategories(unwrapList(res.data).map(mapAdminCategory))
    } catch {
      console.error('Không thể tải danh mục')
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
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
      name: (p: UiAdminProduct) => p.name.toLowerCase(),
      categoryName: (p: UiAdminProduct) => (p.categoryName ?? '').toLowerCase(),
      supplier: (p: UiAdminProduct) => p.supplier.toLowerCase(),
      price: (p: UiAdminProduct) => p.salePrice ?? p.price,
      availableStock: (p: UiAdminProduct) => p.availableStock ?? 0,
      isActive: (p: UiAdminProduct) => (p.isActive ? 1 : 0),
    }),
    []
  )

  const displayedProducts = useMemo(() => {
    let list = products.filter((p) => {
      if (!textMatches(searchQuery, p.name, p.slug, p.supplier, p.categoryName)) return false
      if (filterCategoryId && p.categoryId !== filterCategoryId) return false
      if (filterActive === 'yes' && !p.isActive) return false
      if (filterActive === 'no' && p.isActive) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [products, searchQuery, filterCategoryId, filterActive, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedProducts, [searchQuery, filterCategoryId, filterActive])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      name: '',
      slug: '',
      description: '',
      categoryId: categories[0]?.id || '',
      supplier: '',
      certificationIds: [],
      unit: 'kg',
      price: '',
      salePrice: '',
      isActive: true,
      images: [],
      existingImages: []
    })
    setIsModalOpen(true)
  }

  const openEditModal = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    
    setEditingId(id)
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description,
      categoryId: product.categoryId,
      supplier: product.supplier,
      certificationIds: [
        ...new Set(
          (product.certifications || [])
            .map((c) => toCanonicalCertValue(c))
            .filter((c): c is string => Boolean(c))
        ),
      ],
      unit: product.unit,
      price: String(product.price),
      salePrice: product.salePrice ? String(product.salePrice) : '',
      isActive: product.isActive,
      images: [],
      existingImages: product.images || []
    })
    setIsModalOpen(true)
  }

  const uploadImages = async (files: File[]): Promise<Array<{ secure_url: string; public_id: string }>> => {
    const uploaded = []
    for (const file of files) {
      const fd = new FormData()
      fd.append('image', file)
      try {
        const res = await api.post('/admin/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        const imageData = unwrapData<any>(res.data, {})
        uploaded.push(imageData)
      } catch {
        alert(`Không thể upload ảnh ${file.name}`)
      }
    }
    return uploaded
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)
    
    try {
      let uploadedImages = [...formData.existingImages]
      
      if (formData.images.length > 0) {
        const newImages = await uploadImages(formData.images)
        uploadedImages = [...uploadedImages, ...newImages]
      }

      const editingProduct = editingId ? products.find((p) => p.id === editingId) : null
      const unknownFromEdit =
        editingProduct?.certifications.filter((c) => !toCanonicalCertValue(c)) ?? []
      const certifications = [
        ...new Set([...formData.certificationIds, ...unknownFromEdit].map((c) => String(c).trim()).filter(Boolean)),
      ]

      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        categoryId: formData.categoryId,
        supplier: formData.supplier,
        certifications,
        unit: formData.unit,
        price: Number(formData.price),
        salePrice: formData.salePrice ? Number(formData.salePrice) : null,
        isActive: formData.isActive,
        images: uploadedImages
      }

      if (editingId) {
        await api.put(`/admin/products/${editingId}`, payload)
        alert('Cập nhật sản phẩm thành công')
      } else {
        await api.post('/admin/products', payload)
        alert('Tạo sản phẩm thành công')
      }

      setIsModalOpen(false)
      fetchProducts()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return
    
    try {
      await api.delete(`/admin/products/${id}`)
      alert('Xóa sản phẩm thành công')
      fetchProducts()
    } catch {
      alert('Không thể xóa sản phẩm')
    }
  }

  const handleRemoveExistingImage = async (publicId: string) => {
    try {
      await api.post('/admin/delete-image', { public_id: publicId })
      setFormData(prev => ({
        ...prev,
        existingImages: prev.existingImages.filter(img => img.public_id !== publicId)
      }))
    } catch {
      alert('Không thể xóa ảnh')
    }
  }

  const toggleCertification = (value: string) => {
    setFormData((prev) => {
      const has = prev.certificationIds.includes(value)
      return {
        ...prev,
        certificationIds: has
          ? prev.certificationIds.filter((v) => v !== value)
          : [...prev.certificationIds, value],
      }
    })
  }

  const columns = [
    {
      key: 'images',
      title: 'Ảnh',
      width: '80px',
      render: (item: UiAdminProduct) => (
        item.images[0]?.secure_url ? (
          <img src={item.images[0].secure_url} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
        ) : (
          <div style={{ width: 60, height: 60, background: '#f5f5f4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiBox size={24} color="#a8a29e" />
          </div>
        )
      )
    },
    { key: 'name', title: 'Tên sản phẩm', sortable: true },
    { key: 'categoryName', title: 'Danh mục', sortable: true },
    { key: 'supplier', title: 'Nhà cung cấp', sortable: true },
    {
      key: 'price',
      title: 'Giá',
      sortable: true,
      render: (item: UiAdminProduct) => (
        <div>
          {item.salePrice && (
            <div style={{ textDecoration: 'line-through', color: '#737373', fontSize: 13 }}>
              {item.price.toLocaleString()}đ
            </div>
          )}
          <div style={{ fontWeight: 600, color: 'var(--brand-green)' }}>
            {(item.salePrice || item.price).toLocaleString()}đ
          </div>
        </div>
      )
    },
    {
      key: 'availableStock',
      title: 'Tồn kho',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminProduct) => (
        <Badge variant={item.availableStock && item.availableStock > 0 ? 'success' : 'danger'}>
          {item.availableStock || 0}
        </Badge>
      )
    },
    {
      key: 'isActive',
      title: 'Trạng thái',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminProduct) => (
        <Badge variant={item.isActive ? 'success' : 'default'}>
          {item.isActive ? 'Hoạt động' : 'Tạm ngừng'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '120px',
      align: 'center' as const,
      render: (item: UiAdminProduct) => (
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
        title="Quản lý Sản phẩm"
        subtitle="Quản lý danh sách sản phẩm trong cửa hàng"
        icon={<FiBox />}
        actions={
          <Button onClick={openCreateModal} icon={<FiPlus />}>
            Thêm sản phẩm
          </Button>
        }
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Tên, slug, nhà cung cấp, danh mục…"
          filteredCount={displayedProducts.length}
          totalCount={products.length}
        >
          <Select
            label="Danh mục"
            options={[{ value: '', label: 'Tất cả danh mục' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            containerStyle={{ marginBottom: 0, minWidth: 200 }}
          />
          <Select
            label="Trạng thái"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'yes', label: 'Đang bán' },
              { value: 'no', label: 'Tạm ngừng' },
            ]}
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'yes' | 'no')}
            containerStyle={{ marginBottom: 0, minWidth: 180 }}
          />
        </AdminListToolbar>
        <Table
          columns={columns}
          data={listPage.pagedItems}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Chưa có sản phẩm nào"
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
        title={editingId ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
        width={800}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? 'Đang xử lý...' : editingId ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input
              label="Tên sản phẩm"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              required
              helperText="URL thân thiện (vd: rau-cai-xanh)"
            />
          </div>

          <Textarea
            label="Mô tả"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Select
              label="Danh mục"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
              required
            />
            <Input
              label="Nhà cung cấp"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              required
            />
          </div>

          <fieldset
            style={{
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
              margin: '0 0 16px',
            }}
          >
            <legend style={{ fontWeight: 600, fontSize: 14, padding: '0 6px' }}>Chứng nhận</legend>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Chọn một hoặc nhiều chứng nhận / tiêu chí phổ biến cho nông sản & thực phẩm tại Việt Nam (không bắt buộc).
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '12px 20px',
              }}
            >
              {VIETNAM_FOOD_CERTIFICATION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    fontSize: 13,
                    lineHeight: 1.35,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.certificationIds.includes(opt.value)}
                    onChange={() => toggleCertification(opt.value)}
                    style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--brand-green)', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                    {opt.hint ? (
                      <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 400, marginTop: 4 }}>
                        {opt.hint}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Input
              label="Đơn vị"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              required
            />
            <Input
              label="Giá gốc (đ)"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
              min="0"
            />
            <Input
              label="Giá khuyến mãi (đ)"
              type="number"
              value={formData.salePrice}
              onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
              min="0"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Kích hoạt sản phẩm</span>
            </label>
          </div>

          {formData.existingImages.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
                Ảnh hiện tại
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {formData.existingImages.map((img) => (
                  <div key={img.public_id} style={{ position: 'relative' }}>
                    <img src={img.secure_url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--border-soft)' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingImage(img.public_id)}
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              Tải ảnh mới
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '20px',
                border: '2px dashed var(--border-soft)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: 'var(--surface-soft)',
                transition: 'all 0.2s'
              }}
            >
              <FiUpload size={20} />
              <span>Chọn ảnh để tải lên</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFormData({ ...formData, images: Array.from(e.target.files || []) })}
                style={{ display: 'none' }}
              />
            </label>
            {formData.images.length > 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                {formData.images.length} ảnh đã chọn
              </p>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
