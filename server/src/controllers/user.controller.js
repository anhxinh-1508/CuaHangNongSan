const bcrypt = require("bcryptjs");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { User } = require("../models");
const { cleanText } = require("./helpers");

exports.adminListCustomers = asyncHandler(async (_req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  const data = users.map(({ passwordHash, refreshToken, ...rest }) => rest);
  res.json({ data });
});

exports.adminCreateCustomer = asyncHandler(async (req, res) => {
  const name = cleanText(req.body.name);
  const email = cleanText(req.body.email)?.toLowerCase();
  const password = req.body.password;
  const phone = cleanText(req.body.phone || "") || "";
  const role = req.body.role === "Admin" ? "Admin" : "Customer";
  if (!name || !email || !password)
    throw new AppError("VALIDATION_ERROR", "Thiếu thông tin bắt buộc", 422);
  const existed = await User.findOne({ email });
  if (existed) throw new AppError("EMAIL_EXISTS", "Email đã tồn tại", 409);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, phone, role, isVerified: true, refreshToken: "" });
  const out = user.toObject();
  delete out.passwordHash;
  delete out.refreshToken;
  res.status(201).json({ data: out });
});

exports.adminUpdateCustomer = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng", 404);

  if (req.body.name !== undefined) user.name = cleanText(req.body.name);
  if (req.body.email !== undefined) {
    const nextEmail = cleanText(req.body.email)?.toLowerCase();
    if (nextEmail && nextEmail !== user.email) {
      const dup = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (dup) throw new AppError("EMAIL_EXISTS", "Email đã được sử dụng", 409);
      user.email = nextEmail;
    }
  }
  if (req.body.phone !== undefined) user.phone = cleanText(req.body.phone || "") || "";
  if (req.body.role !== undefined) {
    const nextRole = req.body.role === "Admin" ? "Admin" : "Customer";
    if (String(user._id) === String(req.user._id) && nextRole !== "Admin")
      throw new AppError("FORBIDDEN", "Không thể tự bỏ vai trò Quản trị viên của chính mình", 403);
    user.role = nextRole;
  }
  if (req.body.password) {
    user.passwordHash = await bcrypt.hash(String(req.body.password), 10);
    user.refreshToken = "";
  }
  await user.save();
  const out = user.toObject();
  delete out.passwordHash;
  delete out.refreshToken;
  res.json({ data: out });
});

exports.adminDeleteCustomer = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id))
    throw new AppError("FORBIDDEN", "Không thể xóa tài khoản đang đăng nhập", 403);
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng", 404);
  if (user.role === "Admin") {
    const adminCount = await User.countDocuments({ role: "Admin" });
    if (adminCount <= 1)
      throw new AppError("FORBIDDEN", "Không thể xóa quản trị viên cuối cùng", 403);
  }
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "Đã xóa" });
});
