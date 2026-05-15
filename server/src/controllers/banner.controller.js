const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { Banner } = require("../models");

async function assertBannerTitleUnique(title, excludeId) {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed) return;
  const filter = { title: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } };
  if (excludeId) filter._id = { $ne: excludeId };
  const dup = await Banner.findOne(filter).select("_id").lean();
  if (dup) throw new AppError("DUPLICATE_TITLE", "Tiêu đề banner đã tồn tại", 409);
}

exports.createBanner = asyncHandler(async (req, res) => {
  await assertBannerTitleUnique(req.body.title);
  const data = await Banner.create(req.body);
  res.status(201).json({ data });
});

exports.updateBanner = asyncHandler(async (req, res) => {
  if (req.body.title !== undefined) {
    await assertBannerTitleUnique(req.body.title, req.params.id);
  }
  const data = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) throw new AppError("NOT_FOUND", "Không tìm thấy banner", 404);
  res.json({ data });
});
