const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const {
  dateKeyVN,
  startOfDayVN,
  endOfDayVN,
  endOfTodayVN,
  addCalendarDaysVN,
} = require("../utils/vnTime");
const { Order, Product, Contact, ProductBatch, User, Coupon } = require("../models");
const { refreshBatchStatuses } = require("../services/inventory.service");
const { uploadToCloudinary, deleteFromCloudinary } = require("../middlewares/upload");
const {
  checkAndNotifyBatchExpiry,
  checkAndNotifyCouponExpiry,
} = require("../services/notification.service");

function aggregateTopProductsFromDeliveredOrders(deliveredOrdersLean, nameByProductId) {
  const agg = new Map();
  for (const o of deliveredOrdersLean) {
    for (const item of o.items || []) {
      const pid = item.productId;
      const key = pid ? pid.toString() : `name:${item.productName || "—"}`;
      let row = agg.get(key);
      if (!row) {
        row = { productId: pid || null, name: item.productName || "—", quantity: 0, revenue: 0 };
        agg.set(key, row);
      }
      row.quantity += Number(item.quantity) || 0;
      row.revenue += Number(item.subtotal) || 0;
      if (item.productName) row.name = item.productName;
    }
  }
  const rows = [...agg.values()].map((r) => ({
    _id: r.productId || r.name,
    name: r.productId ? nameByProductId.get(r.productId.toString()) || r.name : r.name,
    soldCount: r.quantity,
    revenue: r.revenue,
  }));
  rows.sort((a, b) => b.soldCount - a.soldCount);
  return rows.slice(0, 5);
}

exports.adminDashboard = asyncHandler(async (_req, res) => {
  await refreshBatchStatuses();
  checkAndNotifyBatchExpiry().catch(() => {});
  checkAndNotifyCouponExpiry().catch(() => {});
  const [orders, deliveredLean, contacts, nearExpiry] = await Promise.all([
    Order.find({}),
    Order.find({ status: "Delivered" }).select("items").lean(),
    Contact.countDocuments({ status: { $in: ["Unread", "Read"] } }),
    ProductBatch.countDocuments({ status: "NearExpiry" }),
  ]);
  const totalRevenue = orders
    .filter((o) => o.status === "Delivered")
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const cancelled = orders.filter((o) => o.status === "Cancelled").length;

  const productIds = new Set();
  for (const o of deliveredLean) {
    for (const item of o.items || []) {
      if (item.productId) productIds.add(item.productId.toString());
    }
  }
  const productDocs = await Product.find({ _id: { $in: [...productIds] } })
    .select("name")
    .lean();
  const nameByProductId = new Map(productDocs.map((p) => [p._id.toString(), p.name]));

  const topProducts = aggregateTopProductsFromDeliveredOrders(deliveredLean, nameByProductId);

  res.json({
    data: {
      totalRevenue,
      totalOrders: orders.length,
      cancelRate: orders.length ? Number(((cancelled / orders.length) * 100).toFixed(2)) : 0,
      nearExpiryCount: nearExpiry,
      unresolvedContacts: contacts,
      topProducts,
    },
  });
});

exports.uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("NO_FILE", "Vui lòng chọn file ảnh", 400);
  const folder = req.query.folder || "general";
  const result = await uploadToCloudinary(req.file.buffer, folder);
  res.json({ data: result });
});

exports.deleteImage = asyncHandler(async (req, res) => {
  const public_id = req.body.public_id ?? req.body.publicId;
  if (!public_id) throw new AppError("MISSING_ID", "Thiếu public_id ảnh", 400);
  await deleteFromCloudinary(public_id);
  res.json({ message: "Image deleted" });
});

exports.adminReports = asyncHandler(async (req, res) => {
  await refreshBatchStatuses();

  let startDate, endDate;
  const range = req.query.range || "30d";

  if (req.query.from) {
    const raw = String(req.query.from).slice(0, 10);
    startDate = startOfDayVN(raw);
    if (Number.isNaN(startDate.getTime())) startDate = null;
  }
  if (req.query.to) {
    const raw = String(req.query.to).slice(0, 10);
    endDate = endOfDayVN(raw);
    if (Number.isNaN(endDate.getTime())) endDate = null;
  }

  if (!startDate) {
    let daysBack = 30;
    if (range === "7d") daysBack = 7;
    else if (range === "90d") daysBack = 90;
    else if (range === "365d") daysBack = 365;
    else if (range === "all") daysBack = 3650;
    const todayKey = dateKeyVN(new Date());
    const startKey = addCalendarDaysVN(todayKey, -daysBack);
    startDate = startOfDayVN(startKey);
  }
  if (!endDate) {
    endDate = endOfTodayVN();
  }

  const [allOrders, batches] = await Promise.all([
    Order.find({}).lean(),
    ProductBatch.find({}).populate("productId", "name").lean(),
  ]);

  const importByBatchId = {};
  for (const b of batches) importByBatchId[b._id.toString()] = Number(b.importPrice) || 0;

  function orderCogs(o) {
    let c = 0;
    for (const a of o.allocations || []) {
      const bid = a.batchId && (a.batchId.toString ? a.batchId.toString() : String(a.batchId));
      if (!bid) continue;
      c += (a.quantity || 0) * (importByBatchId[bid] || 0);
    }
    return c;
  }

  const rangeOrders = allOrders.filter((o) => {
    const t = new Date(o.createdAt);
    return t >= startDate && t <= endDate;
  });
  const deliveredOrders = rangeOrders.filter((o) => o.status === "Delivered");

  // 1. Revenue, COGS & gross profit by day
  const dayStats = {};
  for (const o of deliveredOrders) {
    const day = dateKeyVN(new Date(o.createdAt));
    const cogs = orderCogs(o);
    const netSales = (o.subtotal || 0) - (o.discount || 0);
    if (!dayStats[day]) dayStats[day] = { date: day, revenue: 0, netSales: 0, cogs: 0, grossProfit: 0 };
    dayStats[day].revenue += o.total || 0;
    dayStats[day].netSales += netSales;
    dayStats[day].cogs += cogs;
    dayStats[day].grossProfit += netSales - cogs;
  }
  const revenueTimeline = Object.values(dayStats).sort((a, b) => a.date.localeCompare(b.date));

  // 2. Orders by day
  const ordersByDay = {};
  for (const o of rangeOrders) {
    const day = dateKeyVN(new Date(o.createdAt));
    ordersByDay[day] = (ordersByDay[day] || 0) + 1;
  }
  const ordersTimeline = Object.entries(ordersByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3. Orders by status
  const statusCounts = {};
  for (const o of rangeOrders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  // 4. Revenue & profit summary
  let totalCogs = 0;
  let totalNetSales = 0;
  const totalRevenue = deliveredOrders.reduce((s, o) => {
    totalCogs += orderCogs(o);
    totalNetSales += (o.subtotal || 0) - (o.discount || 0);
    return s + (o.total || 0);
  }, 0);
  const grossProfit = totalNetSales - totalCogs;
  const totalOrders = rangeOrders.length;
  const avgOrderValue = deliveredOrders.length ? Math.round(totalRevenue / deliveredOrders.length) : 0;
  const cancelledCount = rangeOrders.filter((o) => o.status === "Cancelled").length;
  const cancelRate = totalOrders ? Number(((cancelledCount / totalOrders) * 100).toFixed(1)) : 0;

  // 5. Top products (+ giá vốn theo phân bổ lô)
  const productCogs = {};
  for (const o of deliveredOrders) {
    for (const a of o.allocations || []) {
      const pid = a.productId && (a.productId.toString ? a.productId.toString() : String(a.productId));
      if (!pid) continue;
      const bid = a.batchId && (a.batchId.toString ? a.batchId.toString() : String(a.batchId));
      productCogs[pid] = (productCogs[pid] || 0) + (a.quantity || 0) * (importByBatchId[bid] || 0);
    }
  }
  const productSales = {};
  for (const o of deliveredOrders) {
    for (const item of o.items || []) {
      const id = item.productId?.toString() || item.productName;
      if (!productSales[id]) productSales[id] = { name: item.productName || "—", quantity: 0, revenue: 0 };
      productSales[id].quantity += item.quantity || 0;
      productSales[id].revenue += item.subtotal || 0;
    }
  }
  const topProducts = Object.entries(productSales)
    .map(([key, v]) => {
      const cogs = productCogs[key] || 0;
      return { ...v, importCost: cogs, grossProfit: v.revenue - cogs };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // 6. Revenue by category
  const products = await Product.find({}).populate("categoryId", "name").lean();
  const productMap = {};
  for (const p of products) productMap[p._id.toString()] = p;

  const catRevenue = {};
  for (const o of deliveredOrders) {
    for (const item of o.items || []) {
      const prod = productMap[item.productId?.toString()];
      const catName = prod?.categoryId?.name || "Khác";
      catRevenue[catName] = (catRevenue[catName] || 0) + (item.subtotal || 0);
    }
  }
  const revenueByCategory = Object.entries(catRevenue)
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // 7. Inventory summary (+ ước vốn nhập còn tồn theo lô sắp HSD / quá HSD — chưa trừ vào grossProfit)
  const sumBatchCapital = (list) =>
    list.reduce((s, b) => s + (Number(b.quantityInStock) || 0) * (Number(b.importPrice) || 0), 0);
  const nearExpiryRows = batches.filter((b) => b.status === "NearExpiry" && !b.isDisabled);
  const expiredRows = batches.filter((b) => b.status === "Expired" && !b.isDisabled);
  const inventorySummary = {
    totalBatches: batches.length,
    activeBatches: batches.filter((b) => b.status === "Active" && !b.isDisabled).length,
    nearExpiryBatches: batches.filter((b) => b.status === "NearExpiry").length,
    expiredBatches: batches.filter((b) => b.status === "Expired").length,
    outOfStockBatches: batches.filter((b) => b.status === "OutOfStock").length,
    disabledBatches: batches.filter((b) => b.isDisabled).length,
    totalStockValue: batches
      .filter((b) => ["Active", "NearExpiry"].includes(b.status) && !b.isDisabled)
      .reduce((s, b) => s + b.quantityInStock * b.importPrice, 0),
    nearExpiryStockValueEstimate: Math.round(sumBatchCapital(nearExpiryRows)),
    expiredStockValueEstimate: Math.round(sumBatchCapital(expiredRows)),
  };

  // 8. Low stock products
  const stockByProduct = {};
  for (const b of batches) {
    if (b.isDisabled || !["Active", "NearExpiry"].includes(b.status)) continue;
    const pid = b.productId?._id?.toString();
    if (!pid) continue;
    if (!stockByProduct[pid]) stockByProduct[pid] = { name: b.productId?.name || "—", stock: 0 };
    stockByProduct[pid].stock += b.quantityInStock;
  }
  const lowStockProducts = Object.values(stockByProduct)
    .filter((p) => p.stock <= 10)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10);

  // 9. Customer stats
  const totalCustomers = await User.countDocuments({ role: "Customer" });
  const newCustomers = await User.countDocuments({
    role: "Customer",
    createdAt: { $gte: startDate, $lte: endDate },
  });

  // 10. Coupon stats
  const couponStats = await Coupon.aggregate([
    {
      $group: {
        _id: null,
        totalCoupons: { $sum: 1 },
        totalUsed: { $sum: "$usedCount" },
        activeCoupons: { $sum: { $cond: ["$isActive", 1, 0] } },
      },
    },
  ]);

  res.json({
    data: {
      range,
      revenueTimeline,
      ordersTimeline,
      ordersByStatus,
      summary: {
        totalRevenue,
        totalNetSales,
        totalCogs,
        grossProfit,
        totalOrders,
        avgOrderValue,
        cancelRate,
        cancelledCount,
        deliveredCount: deliveredOrders.length,
      },
      topProducts,
      revenueByCategory,
      inventorySummary,
      lowStockProducts,
      customerStats: { totalCustomers, newCustomers },
      couponStats: couponStats[0] || { totalCoupons: 0, totalUsed: 0, activeCoupons: 0 },
    },
  });
});
