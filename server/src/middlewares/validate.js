const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const mapped = errors.array().map((e) => ({
    field: e.path,
    reason: e.msg,
  }));
  return next(new AppError("VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ", 422, mapped));
}

module.exports = validate;
