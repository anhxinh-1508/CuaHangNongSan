import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiFolder, FiPlus, FiTrash2 } from 'react-icons/fi'
import api from '../../api/client'
import { unwrapList, type UiAdminCategory, mapAdminCategory } from '../../api/mappers'
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
  name: string
  slug: string
  isActive: boolean
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<UiAdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'yes' | 'no'>('all')
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    isActive: true
  })

  const fetchCategories = async () => {
    try {
      const res = await api.get('/admin/categories')
      setCategories(unwrapList(res.data).map(mapAdminCategory))
    } catch {
      alert('Không thể tải danh sách danh mục')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      name: '',
      slug: '',
      isActive: true
    })
    setIsModalOpen(true)
  }

  const openEditModal = (id: string) => {
    const category = categories.find(c => c.id === id)
    if (!category) return
    
    setEditingId(id)
    setFormData({
      name: category.name,
      slug: category.slug,
      isActive: category.isActive
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        isActive: formData.isActive
      }

      if (editingId) {
        await api.put(`/admin/categories/${editingId}`, payload)
        alert('Cập nhật danh mục thành công')
      } else {
        await api.post('/admin/categories', payload)
        alert('Tạo danh mục thành công')
      }

      setIsModalOpen(false)
      fetchCategories()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

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
      name: (c: UiAdminCategory) => c.name.toLowerCase(),
      slug: (c: UiAdminCategory) => c.slug.toLowerCase(),
      isActive: (c: UiAdminCategory) => (c.isActive ? 1 : 0),
      createdAt: (c: UiAdminCategory) => timeOrZero(c.createdAt),
    }),
    []
  )

  const displayedCategories = useMemo(() => {
    let list = categories.filter((c) => {
      if (!textMatches(searchQuery, c.name, c.slug)) return false
      if (filterActive === 'yes' && !c.isActive) return false
      if (filterActive === 'no' && c.isActive) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [categories, searchQuery, filterActive, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedCategories, [searchQuery, filterActive])

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa danh mục này? Lưu ý: Các sản phẩm thuộc danh mục này sẽ bị ảnh hưởng.')) return
    
    try {
      await api.delete(`/admin/categories/${id}`)
      alert('Xóa danh mục thành công')
      fetchCategories()
    } catch {
      alert('Không thể xóa danh mục')
    }
  }

  const columns = [
    { key: 'name', title: 'Tên danh mục', sortable: true },
    { key: 'slug', title: 'Slug', sortable: true },
    {
      key: 'isActive',
      title: 'Trạng thái',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminCategory) => (
        <Badge variant={item.isActive ? 'success' : 'default'}>
          {item.isActive ? 'Hoạt động' : 'Tạm ngừng'}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      title: 'Ngày tạo',
      sortable: true,
      render: (item: UiAdminCategory) => 
        item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '-'
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '120px',
      align: 'center' as const,
      render: (item: UiAdminCategory) => (
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
        title="Quản lý Danh mục"
        subtitle="Quản lý danh mục sản phẩm"
        icon={<FiFolder />}
        actions={
          <Button onClick={openCreateModal} icon={<FiPlus />}>
            Thêm danh mục
          </Button>
        }
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Tên danh mục, slug…"
          filteredCount={displayedCategories.length}
          totalCount={categories.length}
        >
          <Select
            label="Trạng thái"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'yes', label: 'Đang hoạt động' },
              { value: 'no', label: 'Tạm ngừng' },
            ]}
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'yes' | 'no')}
            containerStyle={{ marginBottom: 0, minWidth: 200 }}
          />
        </AdminListToolbar>
        <Table
          columns={columns}
          data={listPage.pagedItems}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Chưa có danh mục nào"
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
        title={editingId ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
        width={600}
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
            label="Tên danh mục"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Vd: Rau củ quả"
          />

          <Input
            label="Slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            required
            helperText="URL thân thiện (vd: rau-cu-qua)"
            placeholder="rau-cu-qua"
          />

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Kích hoạt danh mục</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
