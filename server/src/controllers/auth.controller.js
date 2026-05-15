const bcrypt = require("bcryptjs");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const { User, OtpVerification } = require("../models");
const { cleanText } = require("./helpers");
const { sendVerifyOtp, sendResetPasswordOtp, getSmtpFailureInfo } = require("../services/email.service");

function createTokens(user) {
  const payload = { userId: user._id.toString(), role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

exports.health = asyncHandler(async (_req, res) => {
  res.json({ ok: true, name: "FreshFarm Organic API" });
});

exports.register = asyncHandler(async (req, res) => {
  const email = cleanText(req.body.email)?.toLowerCase();
  if (!email) throw new AppError("VALIDATION_ERROR", "Vui lòng nhập email", 422);

  // Email đã có tài khoản đã xác thực → từ chối (user mới chỉ tạo sau bước verify-otp)
  const existed = await User.findOne({ email });
  if (existed) throw new AppError("EMAIL_EXISTS", "Email đã được đăng ký", 409);

  // Chỉ lưu OTP trên server; họ tên + mật khẩu do client gửi lại ở bước verify-otp (HTTPS)
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  await OtpVerification.deleteMany({ email, type: "VERIFY_EMAIL" });
  await OtpVerification.create({
    email,
    otp,
    type: "VERIFY_EMAIL",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendVerifyOtp(email, otp);
  } catch (mailErr) {
    console.error("[Email] Gửi OTP xác thực thất bại:", {
      code: mailErr.code,
      responseCode: mailErr.responseCode,
      command: mailErr.command,
      message: mailErr.message,
    });
    await OtpVerification.deleteMany({ email, type: "VERIFY_EMAIL" });
    const info = getSmtpFailureInfo(mailErr);
    throw new AppError(info.code, info.message, info.status);
  }

  res.status(201).json({
    message: "Vui lòng kiểm tra email để lấy mã OTP xác thực tài khoản.",
  });
});

/** Gửi lại OTP đăng ký (email chưa có tài khoản) */
exports.resendVerifyOtp = asyncHandler(async (req, res) => {
  const email = cleanText(req.body.email)?.toLowerCase();
  if (!email) throw new AppError("VALIDATION_ERROR", "Vui lòng nhập email", 422);

  const existed = await User.findOne({ email });
  if (existed) throw new AppError("EMAIL_EXISTS", "Email đã được đăng ký. Vui lòng đăng nhập.", 409);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await OtpVerification.deleteMany({ email, type: "VERIFY_EMAIL" });
  await OtpVerification.create({
    email,
    otp,
    type: "VERIFY_EMAIL",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendVerifyOtp(email, otp);
  } catch (mailErr) {
    console.error("[Email] Gửi lại OTP xác thực thất bại:", {
      code: mailErr.code,
      responseCode: mailErr.responseCode,
      message: mailErr.message,
    });
    await OtpVerification.deleteMany({ email, type: "VERIFY_EMAIL" });
    const info = getSmtpFailureInfo(mailErr);
    throw new AppError(info.code, info.message, info.status);
  }

  res.json({ message: "Mã OTP mới đã được gửi tới email của bạn." });
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const name = cleanText(req.body.name);
  const email = cleanText(req.body.email)?.toLowerCase();
  const otp = cleanText(req.body.otp);
  const password = req.body.password;

  if (!name || !email || !otp || !password)
    throw new AppError("VALIDATION_ERROR", "Vui lòng nhập đủ họ tên, email, mã OTP và mật khẩu", 422);

  const row = await OtpVerification.findOne({
    email,
    otp,
    type: "VERIFY_EMAIL",
    expiresAt: { $gt: new Date() },
  });
  if (!row) throw new AppError("OTP_INVALID", "Mã OTP không đúng hoặc đã hết hạn", 400);

  const existed = await User.findOne({ email });
  if (existed) {
    await OtpVerification.deleteMany({ email, type: "VERIFY_EMAIL" });
    throw new AppError("EMAIL_EXISTS", "Email đã được đăng ký", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email,
    passwordHash,
    role: "Customer",
    isVerified: true,
  });

  await OtpVerification.deleteMany({ email, type: "VERIFY_EMAIL" });
  res.json({ message: "Xác thực thành công! Bạn có thể đăng nhập ngay." });
});

exports.login = asyncHandler(async (req, res) => {
  const email = cleanText(req.body.email)?.toLowerCase();
  const password = req.body.password;
  const user = await User.findOne({ email });
  if (!user) throw new AppError("LOGIN_FAILED", "Email hoặc mật khẩu không đúng", 401);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError("LOGIN_FAILED", "Email hoặc mật khẩu không đúng", 401);
  if (!user.isVerified)
    throw new AppError("NOT_VERIFIED", "Vui lòng xác thực OTP trước khi đăng nhập", 403);
  const tokens = createTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();
  res.json({
    message: "Login success",
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    },
  });
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken;
  if (!token) throw new AppError("UNAUTHORIZED", "Cần refresh token", 401);
  const payload = verifyRefreshToken(token);
  const user = await User.findById(payload.userId);
  if (!user || user.refreshToken !== token)
    throw new AppError("UNAUTHORIZED", "Refresh token không hợp lệ", 401);
  const tokens = createTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();
  res.json({ data: tokens });
});

exports.logout = asyncHandler(async (req, res) => {
  if (req.user) {
    req.user.refreshToken = "";
    await req.user.save();
  }
  res.json({ message: "Logout success" });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ data: req.user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng", 404);
  const { name, phone } = req.body;
  if (name !== undefined) user.name = cleanText(name);
  if (phone !== undefined) user.phone = cleanText(phone);
  await user.save();
  res.json({
    message: "Profile updated",
    data: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng", 404);
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    throw new AppError("VALIDATION", "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới", 400);
  if (newPassword.length < 6)
    throw new AppError("VALIDATION", "Mật khẩu mới phải có ít nhất 6 ký tự", 400);
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new AppError("WRONG_PASSWORD", "Mật khẩu hiện tại không đúng", 400);
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: "Password changed" });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const email = cleanText(req.body.email)?.toLowerCase();
  if (!email) throw new AppError("VALIDATION_ERROR", "Vui lòng nhập email", 422);

  const user = await User.findOne({ email });
  // Không tiết lộ email có tồn tại hay không
  if (!user) {
    return res.json({ message: "Nếu email tồn tại, mã OTP đã được gửi đến hộp thư của bạn." });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await OtpVerification.deleteMany({ email, type: "RESET_PASSWORD" });
  await OtpVerification.create({
    email,
    otp,
    type: "RESET_PASSWORD",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendResetPasswordOtp(email, otp);
  } catch (mailErr) {
    console.error("[Email] Gửi OTP đặt lại mật khẩu thất bại:", {
      code: mailErr.code,
      responseCode: mailErr.responseCode,
      message: mailErr.message,
    });
    await OtpVerification.deleteMany({ email, type: "RESET_PASSWORD" });
    const info = getSmtpFailureInfo(mailErr);
    throw new AppError(info.code, info.message, info.status);
  }

  res.json({ message: "Nếu email tồn tại, mã OTP đã được gửi đến hộp thư của bạn." });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const email = cleanText(req.body.email)?.toLowerCase();
  const otp = cleanText(req.body.otp);
  const newPassword = req.body.newPassword;

  if (!email || !otp || !newPassword)
    throw new AppError("VALIDATION_ERROR", "Vui lòng nhập đầy đủ email, mã OTP và mật khẩu mới", 422);
  if (newPassword.length < 6)
    throw new AppError("VALIDATION_ERROR", "Mật khẩu mới phải có ít nhất 6 ký tự", 422);

  const row = await OtpVerification.findOne({
    email,
    otp,
    type: "RESET_PASSWORD",
    expiresAt: { $gt: new Date() },
  });
  if (!row) throw new AppError("OTP_INVALID", "Mã OTP không đúng hoặc đã hết hạn", 400);

  const user = await User.findOne({ email });
  if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy tài khoản", 404);

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  await OtpVerification.deleteMany({ email, type: "RESET_PASSWORD" });

  res.json({ message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." });
});
