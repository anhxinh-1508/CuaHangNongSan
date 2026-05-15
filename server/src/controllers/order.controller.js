const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { Cart, Order, Coupon, CouponUsage } = require("../models");
const { allocateByFefo, restoreInventoryForOrder } = require("../services/inventory.service");
const { notifyOrderStatusChange, notifyNewOrder } = require("../services/notification.service");
const env = require("../config/env");

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function resolveCoupon({ couponCode, userId, subtotal }) {
  if (!couponCode) return { discount: 0, coupon: null };
  const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
  if (!coupon) throw new AppError("COUPON_INVALID", "Mã giảm giá không tồn tại", 400);
  const now = new Date();
  if (coupon.startAt > now || coupon.endAt < now)
    throw new AppError("COUPON_INVALID", "Mã giảm giá chưa có hiệu lực hoặc đã hết hạn", 400);
  if (coupon.usedCount >= coupon.usageLimit)
    throw new AppError("COUPON_INVALID", "Mã giảm giá đã hết lượt sử dụng", 400);
  if (subtotal < coupon.minOrderValue)
    throw new AppError("COUPON_INVALID", "Giá trị đơn chưa đạt mức tối thiểu để áp mã", 400);
  if (userId) {
    const usedCount = await CouponUsage.countDocuments({ userId, couponId: coupon._id });
    if (usedCount >= coupon.perUserLimit)
      throw new AppError("COUPON_INVALID", "Bạn đã dùng mã này quá số lần cho phép", 400);
  }
  const discount =
    coupon.discountType === "PERCENT"
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;
  return { discount: Math.min(discount, subtotal), coupon };
}

const validTransitions = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Packing", "Cancelled"],
  Packing: ["Shipping"],
  Shipping: ["Delivered", "DeliveryFailed"],
  DeliveryFailed: ["RetryDelivery", "Cancelled"],
  RetryDelivery: ["Shipping", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

const ALL_ORDER_STATUSES = [
  "Pending", "Confirmed", "Packing", "Shipping",
  "Delivered", "DeliveryFailed", "RetryDelivery", "Cancelled",
];

/** Gộp các dòng trùng productId (body client / giỏ hàng). */
function mergeLineItems(items) {
  const m = new Map();
  for (const it of items || []) {
    if (!it?.productId) continue;
    const id = String(it.productId);
    const q = Number(it.quantity) || 0;
    if (q <= 0) continue;
    m.set(id, (m.get(id) || 0) + q);
  }
  return [...m.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function validateRequestedAgainstCart(cart, requestedMerged) {
  if (!cart?.items?.length)
    throw new AppError("CART_MISMATCH", "Giỏ hàng trống hoặc đã thay đổi", 400);
  const cartMap = new Map(cart.items.map((i) => [String(i.productId), Number(i.quantity) || 0]));
  for (const { productId, quantity } of requestedMerged) {
    const pid = String(productId);
    const have = cartMap.get(pid);
    if (have == null || quantity < 1 || quantity > have) {
      throw new AppError(
        "CART_MISMATCH",
        "Số lượng đặt không khớp giỏ hàng. Vui lòng tải lại trang giỏ.",
        400
      );
    }
  }
}

/** Trừ các dòng đã đặt khỏi giỏ (mongoose document). */
function subtractOrderedFromCartDoc(cart, orderedMerged) {
  const takeMap = new Map(orderedMerged.map((o) => [String(o.productId), Number(o.quantity) || 0]));
  const next = [];
  for (const line of cart.items || []) {
    const pid = String(line.productId);
    let take = takeMap.get(pid) || 0;
    const q = Number(line.quantity) || 0;
    if (take <= 0) {
      next.push({ productId: line.productId, quantity: q });
      continue;
    }
    const used = Math.min(take, q);
    const remain = q - used;
    if (remain > 0) next.push({ productId: line.productId, quantity: remain });
    takeMap.set(pid, take - used);
  }
  cart.items = next;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

exports.publicCoupons = asyncHandler(async (req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    $expr: { $lt: ["$usedCount", "$usageLimit"] },
  })
    .select("code discountType discountValue minOrderValue endAt perUserLimit")
    .sort({ endAt: 1 })
    .lean();

  if (!req.user || !coupons.length) {
    return res.json({ data: coupons.map(({ perUserLimit: _, ...c }) => c) });
  }

  /* Đếm số lần mỗi coupon đã được dùng bởi user này */
  const couponIds = coupons.map((c) => c._id);
  const usages = await CouponUsage.aggregate([
    { $match: { couponId: { $in: couponIds }, userId: req.user._id } },
    { $group: { _id: "$couponId", count: { $sum: 1 } } },
  ]);
  const usageMap = Object.fromEntries(usages.map((u) => [u._id.toString(), u.count]));

  const filtered = coupons
    .filter((c) => {
      const used = usageMap[c._id.toString()] || 0;
      return used < (c.perUserLimit ?? 2);
    })
    .map(({ perUserLimit: _, ...c }) => c);

  res.json({ data: filtered });
});

exports.placeOrder = asyncHandler(async (req, res) => {
  const useGuest = !req.user;
  if (useGuest && !env.allowGuestCheckout)
    throw new AppError("FORBIDDEN", "Đặt hàng không cần đăng nhập đang tắt", 403);

  const session = await mongoose.startSession();
  let createdOrder = null;
  await session.withTransaction(async () => {
    let cartDoc = null;
    if (!useGuest) {
      cartDoc = await Cart.findOne({ userId: req.user._id }).session(session);
    }

    const hadExplicitItems = Array.isArray(req.body.items) && req.body.items.length > 0;
    let requestedItems = hadExplicitItems ? mergeLineItems(req.body.items) : [];
    if (!useGuest && !requestedItems.length) {
      requestedItems = mergeLineItems(cartDoc?.items || []);
    }
    if (!useGuest && hadExplicitItems) {
      validateRequestedAgainstCart(cartDoc, requestedItems);
    }
    if (!requestedItems?.length)
      throw new AppError("EMPTY_ORDER", "Vui lòng thêm ít nhất một sản phẩm vào đơn", 400);

    const shippingAddress = req.body.shippingAddress;
    if (
      !shippingAddress?.receiverName ||
      !shippingAddress?.receiverPhone ||
      !shippingAddress?.province ||
      !shippingAddress?.district ||
      !shippingAddress?.ward ||
      !shippingAddress?.addressLine
    ) {
      throw new AppError("VALIDATION_ERROR", "Thiếu thông tin giao hàng (họ tên, SĐT, địa chỉ...)", 422);
    }

    const paymentMethod = req.body.paymentMethod || "CashOnDelivery";
    const allowedPayment = ["CashOnDelivery", "BankTransfer", "CreditCard", "Ewallet"];
    if (!allowedPayment.includes(paymentMethod))
      throw new AppError("VALIDATION_ERROR", "Phương thức thanh toán không hợp lệ", 422);

    const { allocations, orderItems } = await allocateByFefo(requestedItems, req.user?._id, session);
    const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
    const { discount, coupon } = await resolveCoupon({
      couponCode: req.body.couponCode,
      userId: req.user?._id,
      subtotal,
    });
    const shippingFee = subtotal >= 300000 ? 0 : 20000;
    const total = subtotal - discount + shippingFee;

    const orderCode = `NS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [order] = await Order.create(
      [
        {
          orderCode,
          userId: req.user?._id || null,
          guestInfo: useGuest
            ? {
                name: req.body.guestInfo?.name || "Guest",
                email: req.body.guestInfo?.email || "",
                phone: req.body.guestInfo?.phone || "",
              }
            : undefined,
          shippingAddress,
          note: req.body.note || "",
          receivingTimeSlot: req.body.receivingTimeSlot || "",
          paymentMethod,
          status: "Pending",
          items: orderItems,
          subtotal,
          discount,
          shippingFee,
          total,
          couponCode: coupon?.code || "",
          allocations,
        },
      ],
      { session }
    );
    createdOrder = order;

    if (coupon && req.user) {
      coupon.usedCount += 1;
      await coupon.save({ session });
      await CouponUsage.create(
        [{ couponId: coupon._id, userId: req.user._id, orderId: order._id }],
        { session }
      );
    }
    if (req.user) {
      if (!useGuest && hadExplicitItems) {
        subtractOrderedFromCartDoc(cartDoc, requestedItems);
        await cartDoc.save({ session });
      } else {
        await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } }, { session });
      }
    }
  });
  session.endSession();

  if (createdOrder) {
    notifyNewOrder(createdOrder).catch(() => {});
    if (createdOrder.userId) notifyOrderStatusChange(createdOrder).catch(() => {});
  }
  res.status(201).json({ message: "Order placed", data: createdOrder });
});

exports.myOrders = asyncHandler(async (req, res) => {
  const data = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ data });
});

exports.orderDetail = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };
  if (req.user.role !== "Admin") query.userId = req.user._id;
  const data = await Order.findOne(query);
  if (!data) throw new AppError("NOT_FOUND", "Không tìm thấy đơn hàng", 404);
  res.json({ data });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    const query = { _id: req.params.id };
    if (req.user.role !== "Admin") query.userId = req.user._id;
    const order = await Order.findOne(query).session(session);
    if (!order) throw new AppError("NOT_FOUND", "Không tìm thấy đơn hàng", 404);
    if (order.status !== "Pending")
      throw new AppError("INVALID_STATUS", "Chỉ đơn ở trạng thái chờ xác nhận mới được hủy", 400);
    order.status = "Cancelled";
    await order.save({ session });
    await restoreInventoryForOrder(order, req.user._id, session);
  });
  session.endSession();
  res.json({ message: "Order cancelled and stock restored" });
});

exports.adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  const nextStatus = req.body.status;
  if (!ALL_ORDER_STATUSES.includes(nextStatus))
    throw new AppError("INVALID_STATUS", `Trạng thái không hợp lệ: ${nextStatus}`, 400);

  const session = await mongoose.startSession();
  let updatedOrder;
  await session.withTransaction(async () => {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) throw new AppError("NOT_FOUND", "Không tìm thấy đơn hàng", 404);
    if (order.status === nextStatus)
      throw new AppError("INVALID_STATUS", "Trạng thái không thay đổi", 400);

    const wasCancelled = order.status === "Cancelled";
    order.status = nextStatus;
    await order.save({ session });

    if (nextStatus === "Cancelled" && !wasCancelled)
      await restoreInventoryForOrder(order, req.user._id, session);

    updatedOrder = order;
  });
  session.endSession();

  notifyOrderStatusChange(updatedOrder).catch(() => {});
  res.json({ message: "Order status updated", data: updatedOrder });
});
