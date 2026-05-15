const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const { Product, ProductBatch, InventoryTransaction } = require("../models");

function deriveBatchStatus(expiryDate, quantityInStock) {
  const now = Date.now();
  const expiry = new Date(expiryDate).getTime();
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  if (quantityInStock <= 0) return "OutOfStock";
  if (daysLeft <= 0) return "Expired";
  if (daysLeft <= 3) return "NearExpiry";
  return "Active";
}

async function refreshBatchStatuses() {
  const batches = await ProductBatch.find({});
  await Promise.all(
    batches.map(async (b) => {
      const nextStatus = deriveBatchStatus(b.expiryDate, b.quantityInStock);
      if (nextStatus !== b.status) {
        b.status = nextStatus;
        await b.save();
      }
    })
  );
}

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/** Một query DB: tổng tồn khả dụng theo FEFO rules cho nhiều sản phẩm (dùng cho list/cart/wishlist). */
async function sumAvailableStockForProductIds(productIds) {
  const ids = [...new Set((productIds || []).map((id) => toObjectId(id)).filter(Boolean))];
  if (!ids.length) return new Map();
  const batches = await ProductBatch.find({
    productId: { $in: ids },
    status: { $in: ["Active", "NearExpiry"] },
    isDisabled: { $ne: true },
    expiryDate: { $gt: new Date() },
    quantityInStock: { $gt: 0 },
  })
    .select("productId quantityInStock")
    .lean();

  const map = new Map();
  for (const b of batches) {
    const key = b.productId.toString();
    map.set(key, (map.get(key) || 0) + b.quantityInStock);
  }
  return map;
}

/** Gọi `refreshBatchStatuses()` ở tầng controller khi cần dữ liệu mới; không gọi refresh trong hàm này (tránh N lần quét cả bảng lô). */
async function getAvailableStock(productId) {
  const batches = await ProductBatch.find({
    productId,
    status: { $in: ["Active", "NearExpiry"] },
    isDisabled: { $ne: true },
    expiryDate: { $gt: new Date() },
    quantityInStock: { $gt: 0 },
  }).sort({ expiryDate: 1 });
  return batches.reduce((sum, b) => sum + b.quantityInStock, 0);
}

async function allocateByFefo(items, actorUserId, session) {
  await refreshBatchStatuses();
  const allocations = [];
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId).session(session);
    if (!product || !product.isActive) {
      throw new AppError("PRODUCT_INVALID", "Sản phẩm không khả dụng", 400, [{ field: "productId", reason: "Sản phẩm không hợp lệ" }]);
    }
    const batches = await ProductBatch.find({
      productId: product._id,
      status: { $in: ["Active", "NearExpiry"] },
      isDisabled: { $ne: true },
      expiryDate: { $gt: new Date() },
      quantityInStock: { $gt: 0 },
    })
      .sort({ expiryDate: 1 })
      .session(session);

    let remaining = item.quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const picked = Math.min(remaining, batch.quantityInStock);
      batch.quantityInStock -= picked;
      batch.status = deriveBatchStatus(batch.expiryDate, batch.quantityInStock);
      await batch.save({ session });

      allocations.push({
        productId: product._id,
        batchId: batch._id,
        quantity: picked,
      });

      await InventoryTransaction.create(
        [
          {
            productId: product._id,
            batchId: batch._id,
            type: "ALLOCATE",
            quantity: -picked,
            note: "Allocate by FEFO",
            createdBy: actorUserId || null,
          },
        ],
        { session }
      );
      remaining -= picked;
    }

    if (remaining > 0) {
      throw new AppError(
        "OUT_OF_STOCK",
        `Không đủ hàng cho «${product.name}»`,
        400,
        [{ field: "quantity", reason: "Hết hoặc không đủ tồn kho" }]
      );
    }

    const unitPrice = product.salePrice || product.price;
    orderItems.push({
      productId: product._id,
      productName: product.name,
      productImage: product.images?.[0]?.secure_url || "",
      unit: product.unit,
      supplier: product.supplier || "",
      unitPrice,
      quantity: item.quantity,
      subtotal: unitPrice * item.quantity,
      batchCode: "",
    });
  }

  for (const item of orderItems) {
    const first = allocations.find((a) => a.productId.toString() === item.productId.toString());
    if (first) {
      const b = await ProductBatch.findById(first.batchId).session(session);
      item.batchCode = b?.batchCode || "";
    }
  }

  return { allocations, orderItems };
}

async function restoreInventoryForOrder(order, actorUserId, session) {
  for (const alloc of order.allocations || []) {
    const batch = await ProductBatch.findById(alloc.batchId).session(session);
    if (!batch) continue;
    batch.quantityInStock += alloc.quantity;
    batch.status = deriveBatchStatus(batch.expiryDate, batch.quantityInStock);
    await batch.save({ session });
    await InventoryTransaction.create(
      [
        {
          productId: alloc.productId,
          batchId: alloc.batchId,
          orderId: order._id,
          type: "RESTORE",
          quantity: alloc.quantity,
          note: "Restore stock on order cancel",
          createdBy: actorUserId || null,
        },
      ],
      { session }
    );
  }
}

module.exports = {
  refreshBatchStatuses,
  getAvailableStock,
  sumAvailableStockForProductIds,
  allocateByFefo,
  restoreInventoryForOrder,
  deriveBatchStatus,
};
