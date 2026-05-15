const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { Category } = require("../models");

async function assertCategoryNameUnique(name, excludeId) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return;
  const filter = { name: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } };
  if (excludeId) filter._id = { $ne: excludeId };
  const dup = await Category.findOne(filter).select("_id").lean();
  if (dup) throw new AppError("DUPLICATE_NAME", "Tên danh mục đã tồn tại", 409);
}

exports.createCategory = asyncHandler(async (req, res) => {
  await assertCategoryNameUnique(req.body.name);
  const data = await Category.create(req.body);
  res.status(201).json({ data });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  if (req.body.name !== undefined) {
    await assertCategoryNameUnique(req.body.name, req.params.id);
  }
  const data = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) throw new AppError("NOT_FOUND", "Không tìm thấy danh mục", 404);
  res.json({ data });
});
