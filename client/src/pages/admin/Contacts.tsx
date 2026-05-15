import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiEye, FiMail, FiTrash2 } from 'react-icons/fi'
import api from '../../api/client'
import { unwrapList, type UiAdminContact, mapAdminContact } from '../../api/mappers'
import PageHeader from '../../components/admin/PageHeader'
import Card from '../../components/admin/Card'
import Table from '../../components/admin/Table'
import Modal from '../../components/admin/Modal'
import Button from '../../components/admin/Button'
import Select from '../../components/admin/Select'
import Textarea from '../../components/admin/Textarea'
import Badge from '../../components/admin/Badge'
import AdminListToolbar from '../../components/admin/AdminListToolbar'
import AdminPagination from '../../components/admin/AdminPagination'
import { defaultSortDirection, sortRows, textMatches, timeOrZero } from '../../utils/adminGridHelpers'
import { useAdminListPage } from '../../hooks/useAdminListPage'

const CONTACT_STATUSES = [
  { value: 'Unread', label: 'Chưa đọc' },
  { value: 'Read', label: 'Đã đọc' },
  { value: 'Contacted', label: 'Đã liên hệ' },
  { value: 'Resolved', label: 'Đã giải quyết' },
  { value: 'Failed', label: 'Thất bại' }
]

export default function AdminContacts() {
  const [contacts, setContacts] = useState<UiAdminContact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<UiAdminContact | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  const fetchContacts = async () => {
    try {
      const res = await api.get('/admin/contacts')
      setContacts(unwrapList(res.data).map(mapAdminContact))
    } catch {
      alert('Không thể tải danh sách liên hệ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
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
      name: (c: UiAdminContact) => `${c.name} ${c.email}`.toLowerCase(),
      subject: (c: UiAdminContact) => c.subject.toLowerCase(),
      message: (c: UiAdminContact) => (c.message ?? '').toLowerCase(),
      status: (c: UiAdminContact) => c.status,
      createdAt: (c: UiAdminContact) => timeOrZero(c.createdAt),
    }),
    []
  )

  const displayedContacts = useMemo(() => {
    let list = contacts.filter((c) => {
      if (!textMatches(searchQuery, c.name, c.email, c.subject, c.message)) return false
      if (filterStatus && c.status !== filterStatus) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [contacts, searchQuery, filterStatus, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedContacts, [searchQuery, filterStatus])

  const openDetailModal = (contact: UiAdminContact) => {
    setSelectedContact(contact)
    setIsDetailModalOpen(true)
  }

  const openStatusModal = (contact: UiAdminContact) => {
    setSelectedContact(contact)
    setNewStatus(contact.status)
    setInternalNotes(contact.internalNotes)
    setIsStatusModalOpen(true)
  }

  const handleUpdateStatus = async () => {
    if (!selectedContact) return
    
    try {
      await api.put(`/admin/contacts/${selectedContact.id}`, { 
        status: newStatus,
        internalNotes 
      })
      alert('Cập nhật liên hệ thành công')
      setIsStatusModalOpen(false)
      fetchContacts()
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa liên hệ này?')) return
    
    try {
      await api.delete(`/admin/contacts/${id}`)
      alert('Xóa liên hệ thành công')
      fetchContacts()
    } catch {
      alert('Không thể xóa liên hệ')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default', label: string }> = {
      'Unread': { variant: 'warning', label: 'Chưa đọc' },
      'Read': { variant: 'info', label: 'Đã đọc' },
      'Contacted': { variant: 'info', label: 'Đã liên hệ' },
      'Resolved': { variant: 'success', label: 'Đã giải quyết' },
      'Failed': { variant: 'danger', label: 'Thất bại' }
    }
    const config = statusMap[status] || { variant: 'default' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const columns = [
    { 
      key: 'name', 
      title: 'Tên',
      sortable: true,
      render: (item: UiAdminContact) => (
        <div>
          <div style={{ fontWeight: 600 }}>{item.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.email}</div>
        </div>
      )
    },
    { 
      key: 'subject', 
      title: 'Chủ đề',
      sortable: true,
      render: (item: UiAdminContact) => (
        <span style={{ fontWeight: 600 }}>{item.subject}</span>
      )
    },
    {
      key: 'message',
      title: 'Nội dung',
      sortable: true,
      render: (item: UiAdminContact) => (
        <div style={{ 
          maxWidth: 300, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          color: 'var(--text-secondary)'
        }}>
          {item.message}
        </div>
      )
    },
    {
      key: 'status',
      title: 'Trạng thái',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminContact) => getStatusBadge(item.status)
    },
    {
      key: 'createdAt',
      title: 'Ngày gửi',
      sortable: true,
      render: (item: UiAdminContact) => 
        item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '-'
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '140px',
      align: 'center' as const,
      render: (item: UiAdminContact) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => openDetailModal(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-green)', fontSize: 18 }}
            title="Xem chi tiết"
          >
            <FiEye />
          </button>
          <button
            onClick={() => openStatusModal(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 18 }}
            title="Cập nhật"
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
        title="Quản lý Liên hệ"
        subtitle="Quản lý yêu cầu liên hệ từ khách hàng"
        icon={<FiMail />}
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Tên, email, chủ đề, nội dung…"
          filteredCount={displayedContacts.length}
          totalCount={contacts.length}
        >
          <Select
            label="Trạng thái"
            options={[{ value: '', label: 'Tất cả' }, ...CONTACT_STATUSES]}
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
          emptyText="Chưa có liên hệ nào"
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

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Chi tiết liên hệ"
        width={700}
        footer={
          <Button onClick={() => setIsDetailModalOpen(false)}>
            Đóng
          </Button>
        }
      >
        {selectedContact && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--brand-green)' }}>
                  {selectedContact.subject}
                </h3>
                {getStatusBadge(selectedContact.status)}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Từ: <strong>{selectedContact.name}</strong> ({selectedContact.email})
                <br />
                Ngày gửi: {selectedContact.createdAt ? new Date(selectedContact.createdAt).toLocaleString('vi-VN') : '-'}
              </div>
            </div>

            <div style={{ 
              padding: 20, 
              background: 'var(--surface-soft)', 
              borderRadius: 'var(--radius-md)', 
              marginBottom: 20,
              border: '2px solid var(--border-soft)'
            }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Nội dung tin nhắn:
              </h4>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedContact.message}
              </p>
            </div>

            {selectedContact.internalNotes && (
              <div style={{ 
                padding: 20, 
                background: '#fffbf0', 
                borderRadius: 'var(--radius-md)',
                border: '2px solid #E2A227'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Ghi chú nội bộ:
                </h4>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {selectedContact.internalNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Status Update Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Cập nhật liên hệ"
        width={600}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsStatusModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleUpdateStatus}>
              Cập nhật
            </Button>
          </>
        }
      >
        {selectedContact && (
          <div>
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedContact.name}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{selectedContact.subject}</div>
            </div>

            <Select
              label="Trạng thái"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={CONTACT_STATUSES}
              required
            />

            <Textarea
              label="Ghi chú nội bộ"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={5}
              placeholder="Ghi chú về cách xử lý, kết quả liên hệ..."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
