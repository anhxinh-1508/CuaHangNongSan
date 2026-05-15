const { body } = require("express-validator");

const emailRule = body("email").trim().isEmail().withMessage("Email không hợp lệ").normalizeEmail();

const passwordRule = body("password")
  .isLength({ min: 8, max: 64 })
  .withMessage("Mật khẩu cần 8–64 ký tự")
  .matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
  .withMessage("Mật khẩu phải có cả chữ và số");

const nameRule = body("name").trim().isLength({ min: 2, max: 80 }).withMessage("Họ tên 2–80 ký tự");
const otpRule = body("otp").trim().matches(/^\d{6}$/).withMessage("OTP phải đúng 6 chữ số");

const registerValidator = [nameRule, emailRule, passwordRule];
const resendVerifyOtpValidator = [emailRule];
const loginValidator = [emailRule, body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu")];
/** Xác thực đăng ký: cần email + OTP + họ tên + mật khẩu (gửi lại, không lưu tạm trên server) */
const verifyOtpValidator = [nameRule, emailRule, otpRule, passwordRule];

const productValidator = [
  body("name").trim().isLength({ min: 2, max: 160 }).withMessage("Tên sản phẩm 2–160 ký tự"),
  body("slug").trim().matches(/^[a-z0-9-]+$/).withMessage("Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  body("categoryId").trim().isMongoId().withMessage("Danh mục không hợp lệ"),
  body("price").isFloat({ gt: 0 }).withMessage("Giá phải là số dương"),
  body("salePrice").optional({ nullable: true }).isFloat({ gt: 0 }).withMessage("Giá khuyến mãi phải là số dương"),
  body("unit").trim().notEmpty().withMessage("Đơn vị tính là bắt buộc"),
  body("supplier").trim().notEmpty().withMessage("Nhà cung cấp là bắt buộc"),
];

const batchValidator = [
  body("productId").isMongoId().withMessage("Sản phẩm không hợp lệ"),
  body("batchCode").trim().notEmpty().withMessage("Mã lô là bắt buộc"),
  body("harvestDate").isISO8601().withMessage("Ngày thu hoạch không hợp lệ"),
  body("packingDate").isISO8601().withMessage("Ngày đóng gói không hợp lệ"),
  body("expiryDate").isISO8601().withMessage("Ngày hết hạn không hợp lệ"),
  body("quantityInStock").isInt({ min: 0 }).withMessage("Số lượng tồn phải ≥ 0"),
  body("importPrice").isFloat({ min: 0 }).withMessage("Giá nhập phải ≥ 0"),
];

const couponValidator = [
  body("code").trim().notEmpty().isLength({ min: 3, max: 30 }).withMessage("Mã 3–30 ký tự"),
  body("discountType").isIn(["PERCENT", "FIXED"]).withMessage("Loại giảm giá không hợp lệ"),
  body("discountValue")
    .isFloat({ gt: 0 })
    .withMessage("Giá trị giảm phải > 0")
    .custom((value, { req }) => {
      if (req.body.discountType === "PERCENT" && Number(value) > 100) {
        throw new Error("Giảm theo % không được vượt quá 100%");
      }
      return true;
    }),
  body("usageLimit").isInt({ min: 1 }).withMessage("Tổng lượt dùng mã phải ≥ 1"),
  body("perUserLimit").isInt({ min: 1 }).withMessage("Lượt dùng mỗi khách phải ≥ 1"),
];

const adminCustomerPasswordRule = body("password")
  .isLength({ min: 6, max: 64 })
  .withMessage("Mật khẩu 6-64 ký tự");

const adminCustomerCreateValidator = [
  nameRule,
  emailRule,
  adminCustomerPasswordRule,
  body("phone").optional({ nullable: true }).trim().isLength({ max: 40 }),
  body("role").optional().isIn(["Customer", "Admin"]).withMessage("Vai trò không hợp lệ"),
];

const adminCustomerUpdateValidator = [
  body("name").optional().trim().isLength({ min: 2, max: 80 }).withMessage("Họ tên 2–80 ký tự"),
  body("email").optional().trim().isEmail().withMessage("Email không hợp lệ").normalizeEmail(),
  body("phone").optional({ nullable: true }).trim().isLength({ max: 40 }),
  body("role").optional().isIn(["Customer", "Admin"]).withMessage("Vai trò không hợp lệ"),
  body("password").optional({ checkFalsy: true }).isLength({ min: 6, max: 64 }).withMessage("Mật khẩu 6-64 ký tự"),
];

module.exports = {
  registerValidator,
  resendVerifyOtpValidator,
  loginValidator,
  verifyOtpValidator,
  productValidator,
  batchValidator,
  couponValidator,
  adminCustomerCreateValidator,
  adminCustomerUpdateValidator,
};
