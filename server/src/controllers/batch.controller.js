const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { ProductBatch, Order, Product } = require("../models");
const { refreshBatchStatuses } = require("../services/inventory.service");

async function batchHasOrders(batchId) {
  const count = await Order.countDocuments({
    "allocations.batchId": batchId,
    status: { $nin: ["Cancelled"] },
  });
  return count > 0;
}

exports.adminNearExpiry = asyncHandler(async (_req, res) => {
  await refreshBatchStatuses();
  const data = await ProductBatch.find({ status: "NearExpiry" }).populate("productId", "name");
  res.json({ data });
});

exports.listBatches = asyncHandler(async (_req, res) => {
  await refreshBatchStatuses();
  const batches = await ProductBatch.find({}).sort({ createdAt: -1 }).lean();
  const batchIds = batches.map((b) => b._id);

  const ordersWithBatches = await Order.aggregate([
    { $match: { "allocations.batchId": { $in: batchIds }, status: { $nin: ["Cancelled"] } } },
    { $unwind: "$allocations" },
    { $match: { "allocations.batchId": { $in: batchIds } } },
    { $group: { _id: "$allocations.batchId" } },
  ]);
  const usedBatchIds = new Set(ordersWithBatches.map((o) => o._id.toString()));

  const result = batches.map((b) => ({ ...b, hasOrders: usedBatchIds.has(b._id.toString()) }));
  res.json({ data: result });
});

async function assertBatchCodeUnique(batchCode, excludeId) {
  const code = typeof batchCode === "string" ? batchCode.trim() : "";
  if (!code) return;
  const filter = { batchCode: { $regex: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } };
  if (excludeId) filter._id = { $ne: excludeId };
  const dup = await ProductBatch.findOne(filter).select("_id").lean();
  if (dup) throw new AppError("DUPLICATE_BATCH_CODE", "Mã lô hàng đã tồn tại", 409);
}

/** Giá nhập phải nhỏ hơn giá bán (giá thực tế = salePrice nếu có, ngược lại là price). */
async function assertImportPriceLessThanSalePrice(productId, importPrice) {
  const product = await Product.findById(productId).select("price salePrice name").lean();
  if (!product) throw new AppError("NOT_FOUND", "Không tìm thấy sản phẩm", 404);
  const salePrice = product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
  if (Number(importPrice) >= salePrice) {
    throw new AppError(
      "IMPORT_PRICE_TOO_HIGH",
      `Giá nhập (${Number(importPrice).toLocaleString("vi-VN")}₫) phải nhỏ hơn giá bán của sản phẩm (${salePrice.toLocaleString("vi-VN")}₫)`,
      422
    );
  }
}

exports.createBatch = asyncHandler(async (req, res) => {
  await assertBatchCodeUnique(req.body.batchCode);
  await assertImportPriceLessThanSalePrice(req.body.productId, req.body.importPrice);
  const data = await ProductBatch.create(req.body);
  res.status(201).json({ data });
});

exports.updateBatch = asyncHandler(async (req, res) => {
  const batch = await ProductBatch.findById(req.params.id);
  if (!batch) throw new AppError("NOT_FOUND", "Không tìm thấy lô hàng", 404);
  if (req.body.batchCode !== undefined) {
    await assertBatchCodeUnique(req.body.batchCode, batch._id);
  }
  const productId = req.body.productId ?? batch.productId;
  const importPrice = req.body.importPrice !== undefined ? req.body.importPrice : batch.importPrice;
  await assertImportPriceLessThanSalePrice(productId, importPrice);
  if (await batchHasOrders(batch._id))
    throw new AppError(
      "BATCH_HAS_ORDERS",
      "Lô hàng đã phát sinh đơn hàng, không thể chỉnh sửa. Chỉ có thể vô hiệu hoá.",
      400
    );
  Object.assign(batch, req.body);
  await batch.save();
  res.json({ data: batch });
});

exports.deleteBatch = asyncHandler(async (req, res) => {
  const batch = await ProductBatch.findById(req.params.id);
  if (!batch) throw new AppError("NOT_FOUND", "Không tìm thấy lô hàng", 404);
  if (await batchHasOrders(batch._id))
    throw new AppError("BATCH_HAS_ORDERS", "Lô hàng đã phát sinh đơn hàng, không thể xoá.", 400);
  await ProductBatch.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

exports.toggleBatchDisabled = asyncHandler(async (req, res) => {
  const batch = await ProductBatch.findById(req.params.id);
  if (!batch) throw new AppError("NOT_FOUND", "Không tìm thấy lô hàng", 404);
  batch.isDisabled = !batch.isDisabled;
  await batch.save();
  res.json({
    message: batch.isDisabled ? "Lô hàng đã bị vô hiệu hoá" : "Lô hàng đã được kích hoạt lại",
    data: batch,
  });
});
