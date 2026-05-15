import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiPlus, FiTrash2, FiUsers } from 'react-icons/fi'
import api from '../../api/client'
import { unwrapList, type UiAdminCustomer, mapAdminCustomer } from '../../api/mappers'
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
  email: string
  phone: string
  password: string
  role: 'Customer' | 'Admin'
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<UiAdminCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterVerified, setFilterVerified] = useState<'all' | 'yes' | 'no'>('all')
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'Customer'
  })

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/admin/customers')
      setCustomers(unwrapList(res.data).map(mapAdminCustomer))
    } catch {
      alert('Không thể tải danh sách khách hàng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
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
      name: (c: UiAdminCustomer) => c.name.toLowerCase(),
      email: (c: UiAdminCustomer) => c.email.toLowerCase(),
      phone: (c: UiAdminCustomer) => c.phone.toLowerCase(),
      role: (c: UiAdminCustomer) => c.role,
      isVerified: (c: UiAdminCustomer) => (c.isVerified ? 1 : 0),
      createdAt: (c: UiAdminCustomer) => timeOrZero(c.createdAt),
    }),
    []
  )

  const displayedCustomers = useMemo(() => {
    let list = customers.filter((c) => {
      if (!textMatches(searchQuery, c.name, c.email, c.phone)) return false
      if (filterRole && c.role !== filterRole) return false
      if (filterVerified === 'yes' && !c.isVerified) return false
      if (filterVerified === 'no' && c.isVerified) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [customers, searchQuery, filterRole, filterVerified, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedCustomers, [searchQuery, filterRole, filterVerified])

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'Customer'
    })
    setIsModalOpen(true)
  }

  const openEditModal = (id: string) => {
    const customer = customers.find(c => c.id === id)
    if (!customer) return
    
    setEditingId(id)
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      password: '',
      role: customer.role as 'Customer' | 'Admin'
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role
      }

      if (editingId) {
        if (formData.password) {
          payload.password = formData.password
        }
        await api.put(`/admin/customers/${editingId}`, payload)
        alert('Cập nhật khách hàng thành công')
      } else {
        payload.password = formData.password
        await api.post('/admin/customers', payload)
        alert('Tạo khách hàng thành công')
      }

      setIsModalOpen(false)
      fetchCustomers()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa khách hàng này? Thao tác này không thể hoàn tác.')) return
    
    try {
      await api.delete(`/admin/customers/${id}`)
      alert('Xóa khách hàng thành công')
      fetchCustomers()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể xóa khách hàng')
    }
  }

  const columns = [
    { 
      key: 'name', 
      title: 'Tên',
      sortable: true,
      render: (item: UiAdminCustomer) => (
        <span style={{ fontWeight: 600 }}>{item.name}</span>
      )
    },
    { key: 'email', title: 'Email', sortable: true },
    { key: 'phone', title: 'Số điện thoại', sortable: true },
    {
      key: 'role',
      title: 'Vai trò',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminCustomer) => (
        <Badge variant={item.role === 'Admin' ? 'info' : 'default'}>
          {item.role === 'Admin' ? 'Quản trị' : 'Khách hàng'}
        </Badge>
      )
    },
    {
      key: 'isVerified',
      title: 'Xác thực',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminCustomer) => (
        <Badge variant={item.isVerified ? 'success' : 'warning'}>
          {item.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      title: 'Ngày tạo',
      sortable: true,
      render: (item: UiAdminCustomer) => 
        item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '-'
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '120px',
      align: 'center' as const,
      render: (item: UiAdminCustomer) => (
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
        title="Quản lý Khách hàng"
        subtitle="Quản lý tài khoản khách hàng"
        icon={<FiUsers />}
        actions={
          <Button onClick={openCreateModal} icon={<FiPlus />}>
            Thêm khách hàng
          </Button>
        }
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Tên, email, SĐT…"
          filteredCount={displayedCustomers.length}
          totalCount={customers.length}
        >
          <Select
            label="Vai trò"
            options={[
              { value: '', label: 'Tất cả' },
              { value: 'Customer', label: 'Khách hàng' },
              { value: 'Admin', label: 'Quản trị' },
            ]}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            containerStyle={{ marginBottom: 0, minWidth: 160 }}
          />
          <Select
            label="Xác thực email"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'yes', label: 'Đã xác thực' },
              { value: 'no', label: 'Chưa xác thực' },
            ]}
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value as 'all' | 'yes' | 'no')}
            containerStyle={{ marginBottom: 0, minWidth: 200 }}
          />
        </AdminListToolbar>
        <Table
          columns={columns}
          data={listPage.pagedItems}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Chưa có khách hàng nào"
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
        title={editingId ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
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
            label="Họ và tên"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Nguyễn Văn A"
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            placeholder="example@email.com"
          />

          <Input
            label="Số điện thoại"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="0912345678"
          />

          <Input
            label={editingId ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!editingId}
            placeholder="••••••••"
            helperText={editingId ? 'Chỉ nhập nếu muốn thay đổi mật khẩu' : 'Tối thiểu 6 ký tự'}
          />

          <Select
            label="Vai trò"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'Customer' | 'Admin' })}
            options={[
              { value: 'Customer', label: 'Khách hàng' },
              { value: 'Admin', label: 'Quản trị viên' }
            ]}
            required
          />
        </form>
      </Modal>
    </div>
  )
}
