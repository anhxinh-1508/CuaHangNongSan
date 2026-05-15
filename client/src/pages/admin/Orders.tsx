import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiShoppingBag, FiEye } from 'react-icons/fi'
import api from '../../api/client'
import { unwrapList, type UiAdminOrder, mapAdminOrder } from '../../api/mappers'
import PageHeader from '../../components/admin/PageHeader'
import Card from '../../components/admin/Card'
import Table from '../../components/admin/Table'
import Modal from '../../components/admin/Modal'
import Button from '../../components/admin/Button'
import Select from '../../components/admin/Select'
import Badge from '../../components/admin/Badge'
import AdminListToolbar from '../../components/admin/AdminListToolbar'
import AdminPagination from '../../components/admin/AdminPagination'
import { defaultSortDirection, sortRows, textMatches, timeOrZero } from '../../utils/adminGridHelpers'
import { useAdminListPage } from '../../hooks/useAdminListPage'

const ORDER_STATUSES = [
  { value: 'Pending', label: 'Chờ xác nhận' },
  { value: 'Confirmed', label: 'Đã xác nhận' },
  { value: 'Packing', label: 'Đang đóng gói' },
  { value: 'Shipping', label: 'Đang giao hàng' },
  { value: 'Delivered', label: 'Đã giao hàng' },
  { value: 'DeliveryFailed', label: 'Giao thất bại' },
  { value: 'RetryDelivery', label: 'Giao lại' },
  { value: 'Cancelled', label: 'Đã hủy' }
]

const PAYMENT_FILTERS = [
  { value: '', label: 'Tất cả thanh toán' },
  { value: 'CashOnDelivery', label: 'COD' },
  { value: 'BankTransfer', label: 'QR / VietQR' },
  { value: 'CreditCard', label: 'Thẻ tín dụng' },
  { value: 'Ewallet', label: 'Ví điện tử' },
]

export default function AdminOrders() {
  const [orders, setOrders] = useState<UiAdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<UiAdminOrder | null>(null)
  const [newStatus, setNewStatus] = useState('')

  const fetchOrders = async () => {
    try {
      const res = await api.get('/admin/orders')
      setOrders(unwrapList(res.data).map(mapAdminOrder))
    } catch {
      alert('Không thể tải danh sách đơn hàng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const openDetailModal = (order: UiAdminOrder) => {
    setSelectedOrder(order)
    setIsDetailModalOpen(true)
  }

  const openStatusModal = (order: UiAdminOrder) => {
    setSelectedOrder(order)
    setNewStatus(order.status)
    setIsStatusModalOpen(true)
  }

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return
    
    try {
      await api.put(`/admin/orders/${selectedOrder.id}/status`, { status: newStatus })
      alert('Cập nhật trạng thái đơn hàng thành công')
      setIsStatusModalOpen(false)
      fetchOrders()
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
      orderCode: (o: UiAdminOrder) => o.orderCode.toLowerCase(),
      customer: (o: UiAdminOrder) =>
        `${o.userName ?? ''} ${o.userEmail ?? ''} ${o.guestInfo?.name ?? ''} ${o.guestInfo?.email ?? ''} ${o.guestInfo?.phone ?? ''}`.toLowerCase(),
      total: (o: UiAdminOrder) => o.total,
      paymentMethod: (o: UiAdminOrder) => o.paymentMethod,
      status: (o: UiAdminOrder) => o.status,
      createdAt: (o: UiAdminOrder) => timeOrZero(o.createdAt),
    }),
    []
  )

  const displayedOrders = useMemo(() => {
    let list = orders.filter((o) => {
      if (
        !textMatches(
          searchQuery,
          o.orderCode,
          o.userName,
          o.userEmail,
          o.guestInfo?.name,
          o.guestInfo?.email,
          o.guestInfo?.phone
        )
      )
        return false
      if (filterStatus && o.status !== filterStatus) return false
      if (filterPayment && o.paymentMethod !== filterPayment) return false
      return true
    })
    list = sortRows(list, sortColumn, sortDirection, sortAccessors)
    return list
  }, [orders, searchQuery, filterStatus, filterPayment, sortColumn, sortDirection, sortAccessors])

  const listPage = useAdminListPage(displayedOrders, [searchQuery, filterStatus, filterPayment])

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default', label: string }> = {
      'Pending': { variant: 'warning', label: 'Chờ xác nhận' },
      'Confirmed': { variant: 'info', label: 'Đã xác nhận' },
      'Packing': { variant: 'info', label: 'Đang đóng gói' },
      'Shipping': { variant: 'info', label: 'Đang giao' },
      'Delivered': { variant: 'success', label: 'Đã giao' },
      'DeliveryFailed': { variant: 'danger', label: 'Giao thất bại' },
      'RetryDelivery': { variant: 'warning', label: 'Giao lại' },
      'Cancelled': { variant: 'default', label: 'Đã hủy' }
    }
    const config = statusMap[status] || { variant: 'default' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const columns = [
    { 
      key: 'orderCode', 
      title: 'Mã đơn',
      sortable: true,
      render: (item: UiAdminOrder) => (
        <span style={{ fontWeight: 700, color: 'var(--brand-green)' }}>
          {item.orderCode}
        </span>
      )
    },
    {
      key: 'customer',
      title: 'Khách hàng',
      sortable: true,
      render: (item: UiAdminOrder) => (
        <div>
          <div style={{ fontWeight: 600 }}>{item.userName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.userEmail}</div>
        </div>
      )
    },
    {
      key: 'total',
      title: 'Tổng tiền',
      sortable: true,
      render: (item: UiAdminOrder) => (
        <span style={{ fontWeight: 700, color: 'var(--brand-green)' }}>
          {item.total.toLocaleString()}đ
        </span>
      )
    },
    {
      key: 'paymentMethod',
      title: 'Thanh toán',
      sortable: true,
      render: (item: UiAdminOrder) => {
        const methodMap: Record<string, string> = {
          'CashOnDelivery': 'COD',
          'BankTransfer': 'QR / VietQR',
          'CreditCard': 'Thẻ tín dụng',
          'Ewallet': 'Ví điện tử'
        }
        return methodMap[item.paymentMethod] || item.paymentMethod
      }
    },
    {
      key: 'status',
      title: 'Trạng thái',
      sortable: true,
      align: 'center' as const,
      render: (item: UiAdminOrder) => getStatusBadge(item.status)
    },
    {
      key: 'createdAt',
      title: 'Ngày đặt',
      sortable: true,
      render: (item: UiAdminOrder) => 
        item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '-'
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '120px',
      align: 'center' as const,
      render: (item: UiAdminOrder) => (
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
            title="Cập nhật trạng thái"
          >
            <FiEdit2 />
          </button>
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Quản lý Đơn hàng"
        subtitle="Quản lý và theo dõi đơn hàng"
        icon={<FiShoppingBag />}
      />

      <Card>
        <AdminListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Mã đơn, email, tên khách…"
          filteredCount={displayedOrders.length}
          totalCount={orders.length}
        >
          <Select
            label="Trạng thái đơn"
            options={[{ value: '', label: 'Tất cả' }, ...ORDER_STATUSES]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            containerStyle={{ marginBottom: 0, minWidth: 200 }}
          />
          <Select
            label="Thanh toán"
            options={PAYMENT_FILTERS}
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            containerStyle={{ marginBottom: 0, minWidth: 180 }}
          />
        </AdminListToolbar>
        <Table
          columns={columns}
          data={listPage.pagedItems}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Chưa có đơn hàng nào"
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
        title="Chi tiết đơn hàng"
        width={900}
        footer={
          <Button onClick={() => setIsDetailModalOpen(false)}>
            Đóng
          </Button>
        }
      >
        {selectedOrder && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--brand-green)' }}>
                  Thông tin đơn hàng
                </h3>
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <p style={{ margin: '4px 0' }}><strong>Mã đơn:</strong> {selectedOrder.orderCode}</p>
                  <p style={{ margin: '4px 0' }}><strong>Trạng thái:</strong> {getStatusBadge(selectedOrder.status)}</p>
                  <p style={{ margin: '4px 0' }}><strong>Thanh toán:</strong> {selectedOrder.paymentMethod}</p>
                  <p style={{ margin: '4px 0' }}><strong>Ngày đặt:</strong> {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('vi-VN') : '-'}</p>
                </div>
              </div>
              
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--brand-green)' }}>
                  Thông tin giao hàng
                </h3>
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <p style={{ margin: '4px 0' }}><strong>Người nhận:</strong> {selectedOrder.shippingAddress.receiverName}</p>
                  <p style={{ margin: '4px 0' }}><strong>SĐT:</strong> {selectedOrder.shippingAddress.receiverPhone}</p>
                  <p style={{ margin: '4px 0' }}><strong>Địa chỉ:</strong> {selectedOrder.shippingAddress.addressLine}</p>
                  <p style={{ margin: '4px 0' }}>{selectedOrder.shippingAddress.ward}, {selectedOrder.shippingAddress.district}, {selectedOrder.shippingAddress.province}</p>
                  {selectedOrder.receivingTimeSlot && (
                    <p style={{ margin: '4px 0' }}><strong>Thời gian nhận:</strong> {selectedOrder.receivingTimeSlot}</p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--brand-green)' }}>
                Sản phẩm
              </h3>
              <div style={{ border: '2px solid var(--border-soft)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {selectedOrder.items.map((item, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      display: 'flex', 
                      gap: 16, 
                      padding: 16,
                      borderBottom: idx < selectedOrder.items.length - 1 ? '1px solid var(--border-soft)' : 'none'
                    }}
                  >
                    {item.productImage && (
                      <img 
                        src={item.productImage} 
                        alt={item.productName} 
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.productName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {item.supplier} • {item.unit}
                        {item.batchCode && ` • Lô: ${item.batchCode}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{item.unitPrice.toLocaleString()}đ × {item.quantity}</div>
                      <div style={{ color: 'var(--brand-green)', fontWeight: 700 }}>{item.subtotal.toLocaleString()}đ</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 100, marginBottom: 8 }}>
                <span>Tạm tính:</span>
                <span style={{ fontWeight: 600 }}>{selectedOrder.subtotal.toLocaleString()}đ</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 100, marginBottom: 8, color: '#dc2626' }}>
                  <span>Giảm giá:</span>
                  <span style={{ fontWeight: 600 }}>-{selectedOrder.discount.toLocaleString()}đ</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 100, marginBottom: 8 }}>
                <span>Phí vận chuyển:</span>
                <span style={{ fontWeight: 600 }}>{selectedOrder.shippingFee.toLocaleString()}đ</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: 100,
                paddingTop: 12,
                borderTop: '2px solid var(--border-soft)',
                fontSize: 18
              }}>
                <span style={{ fontWeight: 700 }}>Tổng cộng:</span>
                <span style={{ fontWeight: 700, color: 'var(--brand-green)' }}>{selectedOrder.total.toLocaleString()}đ</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Status Update Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Cập nhật trạng thái đơn hàng"
        width={500}
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
        {selectedOrder && (
          <div>
            <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
              Đơn hàng: <strong style={{ color: 'var(--brand-green)' }}>{selectedOrder.orderCode}</strong>
            </p>
            <Select
              label="Trạng thái mới"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={ORDER_STATUSES}
              required
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
