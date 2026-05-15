/**
 * Dùng chung cho nhiều controller.
 */

const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");

function cleanText(v) {
  return typeof v === "string" ? v.trim() : v;
}

/** Generic CRUD handler dùng cho Category, Banner, Coupon, … */
const adminCrudFactory = (Model) =>
  asyncHandler(async (req, res) => {
    if (req.method === "GET") {
      const data = await Model.find({}).sort({ createdAt: -1 });
      return res.json({ data });
    }
    if (req.method === "POST") {
      const data = await Model.create(req.body);
      return res.status(201).json({ data });
    }
    if (req.method === "PUT") {
      const data = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return res.json({ data });
    }
    if (req.method === "DELETE") {
      await Model.findByIdAndDelete(req.params.id);
      return res.json({ message: "Deleted" });
    }
    throw new AppError("NOT_FOUND", "Thao tác không được hỗ trợ", 404);
  });

module.exports = { cleanText, adminCrudFactory };
