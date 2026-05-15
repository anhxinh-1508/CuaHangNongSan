const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { Product, Cart, Wishlist } = require("../models");
const {
  getAvailableStock,
  sumAvailableStockForProductIds,
  refreshBatchStatuses,
} = require("../services/inventory.service");

// ─── Cart ─────────────────────────────────────────────────────────────────────

exports.getCart = asyncHandler(async (req, res) => {
  await refreshBatchStatuses();
  const cart = await Cart.findOne({ userId: req.user._id }).lean();
  if (!cart) return res.json({ data: { items: [] } });
  const itemIds = cart.items.map((i) => i.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: itemIds } }).lean();
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const stockMap = await sumAvailableStockForProductIds(itemIds);
  const hydrated = [];
  for (const item of cart.items) {
    const pid = item.productId?.toString();
    const product = productMap.get(pid);
    if (!product) continue;
    hydrated.push({ ...item, product, availableStock: stockMap.get(pid) || 0 });
  }
  res.json({ data: { ...cart, items: hydrated } });
});

exports.upsertCart = asyncHandler(async (req, res) => {
  const productId = req.body.productId;
  const quantity = Number(req.body.quantity || 1);
  /** true = cộng dồn vào dòng đã có (thêm từ PDP / wishlist); false/absent = đặt đúng số lượng (nút +/- giỏ hàng) */
  const merge = Boolean(req.body.merge);
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new AppError("PRODUCT_INVALID", "Sản phẩm không khả dụng", 400);
  await refreshBatchStatuses();
  const stock = await getAvailableStock(productId);
  if (quantity < 1 || quantity > 99) throw new AppError("INVALID_QUANTITY", "Số lượng không hợp lệ", 400);
  const cart =
    (await Cart.findOne({ userId: req.user._id })) ||
    (await Cart.create({ userId: req.user._id, items: [] }));
  const existing = cart.items.find((i) => String(i.productId) === String(productId));
  let nextTotal;
  if (existing && merge) {
    nextTotal = existing.quantity + quantity;
  } else if (existing) {
    nextTotal = quantity;
  } else {
    nextTotal = quantity;
  }
  if (nextTotal < 1 || nextTotal > 99 || nextTotal > stock)
    throw new AppError("INVALID_QUANTITY", "Số lượng không hợp lệ hoặc vượt tồn kho", 400);
  if (existing) existing.quantity = nextTotal;
  else cart.items.push({ productId, quantity: nextTotal });
  await cart.save();
  res.json({ message: "Cart updated" });
});

exports.removeCartItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) return res.json({ message: "No cart" });
  cart.items = cart.items.filter((i) => i.productId.toString() !== req.params.productId);
  await cart.save();
  res.json({ message: "Item removed" });
});

exports.clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } });
  res.json({ message: "Cart cleared" });
});

// ─── Wishlist ─────────────────────────────────────────────────────────────────

exports.getWishlist = asyncHandler(async (req, res) => {
  await refreshBatchStatuses();
  const wishlist = await Wishlist.findOne({ userId: req.user._id }).populate("productIds");
  if (!wishlist) return res.json({ data: { productIds: [] } });
  const docs = wishlist.productIds.filter((d) => d?._id);
  const stockMap = await sumAvailableStockForProductIds(docs.map((d) => d._id));
  const enriched = [];
  for (const doc of docs) {
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.availableStock = stockMap.get(doc._id.toString()) || 0;
    enriched.push(obj);
  }
  const data = wishlist.toObject();
  data.productIds = enriched;
  res.json({ data });
});

exports.addWishlist = asyncHandler(async (req, res) => {
  const productId = req.body.productId;
  const product = await Product.findById(productId);
  if (!product || !product.isActive)
    throw new AppError("PRODUCT_INVALID", "Sản phẩm không hợp lệ hoặc đã ngừng bán", 400);
  const wishlist =
    (await Wishlist.findOne({ userId: req.user._id })) ||
    (await Wishlist.create({ userId: req.user._id, productIds: [] }));
  if (!wishlist.productIds.some((id) => id.toString() === productId)) {
    wishlist.productIds.push(productId);
    await wishlist.save();
  }
  res.json({ message: "Wishlist updated" });
});

exports.removeWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ userId: req.user._id });
  if (!wishlist) return res.json({ message: "Wishlist empty" });
  wishlist.productIds = wishlist.productIds.filter((id) => id.toString() !== req.params.productId);
  await wishlist.save();
  res.json({ message: "Wishlist updated" });
});
