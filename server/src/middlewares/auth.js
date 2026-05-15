const AppError = require("../utils/appError");
const { verifyAccessToken } = require("../utils/jwt");
const { User } = require("../models");

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return next(new AppError("UNAUTHORIZED", "Thiếu token đăng nhập", 401));
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (!user) {
      return next(new AppError("UNAUTHORIZED", "Không tìm thấy người dùng", 401));
    }
    req.user = user;
    next();
  } catch (error) {
    next(new AppError("UNAUTHORIZED", "Token không hợp lệ hoặc đã hết hạn", 401));
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (user) req.user = user;
  } catch (error) {
    // Ignore invalid token on optional auth routes.
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này", 403));
    }
    return next();
  };
}

module.exports = { auth, optionalAuth, requireRole };
