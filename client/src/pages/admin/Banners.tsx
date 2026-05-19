import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiImage, FiPlus, FiTrash2, FiUpload } from 'react-icons/fi'
import api from '../../api/client'
import { unwrapData, unwrapList, type UiAdminBanner, mapAdminBanner } from '../../api/mappers'
import PageHeader from '../../components/admin/PageHeader'
import Card from '../../components/admin/Card'
import Table from '../../components/admin/Table'
import Modal from '../../components/admin/Modal'
import Button from '../../components/admin/Button'
import Input from '../../components/admin/Input'
import Badge from '../../components/admin/Badge'
import AdminListToolbar from '../../components/admin/AdminListToolbar'
import AdminPagination from '../../components/admin/AdminPagination'
import Select from '../../components/admin/Select'
import { defaultSortDirection, sortRows, textMatches, timeOrZero } from '../../utils/adminGridHelpers'
import { useAdminListPage } from '../../hooks/useAdminListPage'

type FormData = {
  title: string
  link: string
  isActive: boolean
  imageFile: File | null
  existingImage: { secure_url: string; public_id: string } | null
}

export default function AdminBanners() {
  const [banners, setBanners] = useState<UiAdminBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'yes' | 'no'>('all')
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    link: '',
    isActive: true,
    imageFile: null,
    existingImage: null
  })

  const fetchBanners = async () => {
    try {
      const res = await api.get('/admin/banners')
      setBanners(unwrapList(res.data).map(mapAdminBanner))
    } catch {
      alert('Không thể tải danh sách banner')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners()
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
      title: (b: UiAdminBanner) => b.title.toLowerCase(),
      link: (b: UiAdminBanner) => (b.link ?? '').toLowerCase(),
      isActive: (b: UiAdminBanner) => (b.isActive ? 1 : 0),
      createdAt: (b: UiAdminBanner) => timeOrZero(b.createdAt),
    }),
    []
  )

  const displayedBanners = useMemo(() => {
    let list = banners.filter((b) => {
      if (!textMatches(searchQuery, b.title, b.link)) return false
      if (filterActive === 'yes' && !b.isActive) return false
      if (filterActive === 'no' && b.isActive) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [banners, searchQuery, filterActive, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedBanners, [searchQuery, filterActive])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      title: '',
      link: '',
      isActive: true,
      imageFile: null,
      existingImage: null
    })
    setIsModalOpen(true)
  }

  const openEditModal = (id: string) => {
    const banner = banners.find(b => b.id === id)
    if (!banner) return
    
    setEditingId(id)
    setFormData({
      title: banner.title,
      link: banner.link,
      isActive: banner.isActive,
      imageFile: null,
      existingImage: banner.image
    })
    setIsModalOpen(true)
  }

  const uploadImage = async (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    const res = await api.post('/admin/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return unwrapData<any>(res.data, {})
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setUploading(true)
    
    try {
      let imageData = formData.existingImage
      
      if (formData.imageFile) {
        imageData = await uploadImage(formData.imageFile)
      }

      if (!imageData && !editingId) {
        alert('Vui lòng chọn ảnh cho banner')
        setUploading(false)
        return
      }

      const payload = {
        title: formData.title,
        link: formData.link,
        isActive: formData.isActive,
        image: imageData
      }

      if (editingId) {
        await api.put(`/admin/banners/${editingId}`, payload)
        alert('Cập nhật banner thành công')
      } else {
        await api.post('/admin/banners', payload)
        alert('Tạo banner thành công')
      }

      setIsModalOpen(false)
      fetchBanners()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa banner này?')) return
    
    try {
      await api.delete(`/admin/banners/${id}`)
      alert('Xóa banner thành công')
      fetchBanners()
    } catch {
      alert('Không thể xóa banner')
    }
  }

  const columns = [
    {
      key: 'image',
      title: 'Hình ảnh',
      width: '200px',
      render: (item: UiAdminBanner) => (
        item.image?.secure_url ? (
          <img 
            src={item.image.secure_url} 
            alt={item.title} 
            style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} 
          />
        ) : (
          <div style={{ width: '100%', height: 80, background: '#f5f5f4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiImage size={32} color="#a8a29e" />
          </div>
        )
      )
    },
    { key: 'title', title: 'Tiêu đề', sortable: true },
    { 
      key: 'link', 
      title: 'Liên kết',
      sortable: true,
      render: (item: UiAdminBanner) => (
        item.link ? (
          <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-green)' }}>
            {item.link.length > 40 ? item.link.substring(0, 40) + '...' : item.link}
          </a>
        ) : '-'
      )
    },
    {
      key: 'isActive',
      title: 'Trạng thái',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminBanner) => (
        <Badge variant={item.isActive ? 'success' : 'default'}>
          {item.isActive ? 'Hoạt động' : 'Tạm ngừng'}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      title: 'Ngày tạo',
      sortable: true,
      render: (item: UiAdminBanner) =>
        item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—',
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '120px',
      align: 'center' as const,
      render: (item: UiAdminBanner) => (
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
        title="Quản lý Banner"
        subtitle="Quản lý banner hiển thị trên trang chủ"
        icon={<FiImage />}
        actions={
          <Button onClick={openCreateModal} icon={<FiPlus />}>
            Thêm banner
          </Button>
        }
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Tiêu đề, liên kết…"
          filteredCount={displayedBanners.length}
          totalCount={banners.length}
        >
          <Select
            label="Trạng thái"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'yes', label: 'Đang hiển thị' },
              { value: 'no', label: 'Tạm ngừng' },
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
          emptyText="Chưa có banner nào"
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
        title={editingId ? 'Chỉnh sửa banner' : 'Thêm banner mới'}
        width={700}
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
          <Input
            label="Tiêu đề"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            placeholder="Vd: Khuyến mãi mùa hè"
          />

          <Input
            label="Liên kết"
            value={formData.link}
            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
            placeholder="https://... (tùy chọn)"
          />

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Kích hoạt banner</span>
            </label>
          </div>

          {formData.existingImage && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
                Ảnh hiện tại
              </label>
              <img 
                src={formData.existingImage.secure_url} 
                alt="" 
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--border-soft)' }} 
              />
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
              {formData.existingImage ? 'Thay đổi ảnh' : 'Tải ảnh lên'}
              {!formData.existingImage && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
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
                accept="image/*"
                onChange={(e) => setFormData({ ...formData, imageFile: e.target.files?.[0] || null })}
                style={{ display: 'none' }}
              />
            </label>
            {formData.imageFile && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                {formData.imageFile.name}
              </p>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
