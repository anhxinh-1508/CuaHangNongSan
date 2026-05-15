const { Notification, User, ProductBatch, Product, Coupon } = require("../models");

const ORDER_STATUS_LABELS = {
  Pending: "Chờ xác nhận",
  Confirmed: "Đã xác nhận",
  Packing: "Đang đóng gói",
  Shipping: "Đang giao hàng",
  Delivered: "Đã giao thành công",
  DeliveryFailed: "Giao hàng thất bại",
  RetryDelivery: "Đang giao lại",
  Cancelled: "Đã huỷ",
};

async function getAdminIds() {
  const admins = await User.find({ role: "Admin" }).select("_id").lean();
  return admins.map((a) => a._id);
}

async function notifyOrderStatusChange(order) {
  if (!order.userId) return;
  const label = ORDER_STATUS_LABELS[order.status] || order.status;
  await Notification.create({
    userId: order.userId,
    type: "ORDER_STATUS",
    title: `Đơn hàng ${order.orderCode}`,
    message: `Trạng thái đơn hàng đã cập nhật: ${label}`,
    link: `/orders/${order._id}`,
    meta: { orderId: order._id, orderCode: order.orderCode, status: order.status },
  });
}

async function notifyNewOrder(order) {
  const adminIds = await getAdminIds();
  const docs = adminIds.map((userId) => ({
    userId,
    type: "NEW_ORDER",
    title: "Đơn hàng mới",
    message: `Đơn hàng ${order.orderCode} — ${order.total?.toLocaleString("vi-VN")}₫`,
    link: "/admin/orders",
    meta: { orderId: order._id, orderCode: order.orderCode },
  }));
  if (docs.length) await Notification.insertMany(docs);
}

async function notifyNewContact(contact) {
  const adminIds = await getAdminIds();
  const docs = adminIds.map((userId) => ({
    userId,
    type: "NEW_CONTACT",
    title: "Liên hệ mới",
    message: `${contact.name}: ${contact.subject}`,
    link: "/admin/contacts",
    meta: { contactId: contact._id },
  }));
  if (docs.length) await Notification.insertMany(docs);
}

async function checkAndNotifyBatchExpiry() {
  const adminIds = await getAdminIds();
  if (!adminIds.length) return;

  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const nearExpiryBatches = await ProductBatch.find({
    expiryDate: { $gt: now, $lte: threeDays },
    quantityInStock: { $gt: 0 },
    isDisabled: { $ne: true },
  })
    .populate("productId", "name")
    .lean();

  const expiredBatches = await ProductBatch.find({
    expiryDate: { $lte: now },
    quantityInStock: { $gt: 0 },
    isDisabled: { $ne: true },
  })
    .populate("productId", "name")
    .lean();

  const docs = [];

  for (const b of nearExpiryBatches) {
    const existing = await Notification.findOne({
      type: "BATCH_NEAR_EXPIRY",
      "meta.batchId": b._id,
      createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    });
    if (existing) continue;

    const pName = b.productId?.name || "Sản phẩm";
    const productRef = b.productId && typeof b.productId === "object" ? b.productId._id : b.productId;
    const productIdStr = productRef ? String(productRef) : "";
    const expDate = new Date(b.expiryDate).toLocaleDateString("vi-VN");
    for (const userId of adminIds) {
      docs.push({
        userId,
        type: "BATCH_NEAR_EXPIRY",
        title: "Lô hàng sắp hết hạn",
        message: `${pName} — lô ${b.batchCode} hết hạn ${expDate}`,
        link: productIdStr ? `/admin/products/${productIdStr}` : "/admin/batches",
        meta: { batchId: b._id, batchCode: b.batchCode, productId: productIdStr || undefined },
      });
    }
  }

  for (const b of expiredBatches) {
    const existing = await Notification.findOne({
      type: "BATCH_EXPIRED",
      "meta.batchId": b._id,
      createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    });
    if (existing) continue;

    const pName = b.productId?.name || "Sản phẩm";
    const productRef = b.productId && typeof b.productId === "object" ? b.productId._id : b.productId;
    const productIdStr = productRef ? String(productRef) : "";
    for (const userId of adminIds) {
      docs.push({
        userId,
        type: "BATCH_EXPIRED",
        title: "Lô hàng hết hạn",
        message: `${pName} — lô ${b.batchCode} đã hết hạn`,
        link: productIdStr ? `/admin/products/${productIdStr}` : "/admin/batches",
        meta: { batchId: b._id, batchCode: b.batchCode, productId: productIdStr || undefined },
      });
    }
  }

  if (docs.length) await Notification.insertMany(docs);
}

async function checkAndNotifyCouponExpiry() {
  const adminIds = await getAdminIds();
  if (!adminIds.length) return;

  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const nearExpiry = await Coupon.find({
    endAt: { $gt: now, $lte: threeDays },
    isActive: true,
  }).lean();

  const expired = await Coupon.find({
    endAt: { $lte: now },
    isActive: true,
  }).lean();

  const docs = [];

  for (const c of nearExpiry) {
    const existing = await Notification.findOne({
      type: "COUPON_NEAR_EXPIRY",
      "meta.couponId": c._id,
      createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    });
    if (existing) continue;

    const endDate = new Date(c.endAt).toLocaleDateString("vi-VN");
    for (const userId of adminIds) {
      docs.push({
        userId,
        type: "COUPON_NEAR_EXPIRY",
        title: "Voucher sắp hết hạn",
        message: `Mã ${c.code} hết hạn ${endDate}`,
        link: "/admin/coupons",
        meta: { couponId: c._id, code: c.code },
      });
    }
  }

  for (const c of expired) {
    const existing = await Notification.findOne({
      type: "COUPON_EXPIRED",
      "meta.couponId": c._id,
      createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    });
    if (existing) continue;

    for (const userId of adminIds) {
      docs.push({
        userId,
        type: "COUPON_EXPIRED",
        title: "Voucher đã hết hạn",
        message: `Mã ${c.code} đã hết hạn`,
        link: "/admin/coupons",
        meta: { couponId: c._id, code: c.code },
      });
    }
  }

  if (docs.length) await Notification.insertMany(docs);
}

module.exports = {
  notifyOrderStatusChange,
  notifyNewOrder,
  notifyNewContact,
  checkAndNotifyBatchExpiry,
  checkAndNotifyCouponExpiry,
};
