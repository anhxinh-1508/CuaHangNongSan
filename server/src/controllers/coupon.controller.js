const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { Coupon } = require("../models");

async function assertCouponCodeUnique(code, excludeId) {
  const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!normalized) return;
  const filter = { code: normalized };
  if (excludeId) filter._id = { $ne: excludeId };
  const dup = await Coupon.findOne(filter).select("_id").lean();
  if (dup) throw new AppError("DUPLICATE_CODE", "Mã giảm giá đã tồn tại", 409);
}

exports.createCoupon = asyncHandler(async (req, res) => {
  await assertCouponCodeUnique(req.body.code);
  const data = await Coupon.create(req.body);
  res.status(201).json({ data });
});

exports.updateCoupon = asyncHandler(async (req, res) => {
  if (req.body.code !== undefined) {
    await assertCouponCodeUnique(req.body.code, req.params.id);
  }
  const data = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) throw new AppError("NOT_FOUND", "Không tìm thấy mã giảm giá", 404);
  res.json({ data });
});
