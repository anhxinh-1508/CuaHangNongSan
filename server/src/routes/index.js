const express = require("express");
const rateLimit = require("express-rate-limit");

const authCtrl = require("../controllers/auth.controller");
const productCtrl = require("../controllers/product.controller");
const cartCtrl = require("../controllers/cart.controller");
const orderCtrl = require("../controllers/order.controller");
const contactCtrl = require("../controllers/contact.controller");
const chatCtrl = require("../controllers/chat.controller");
const notificationCtrl = require("../controllers/notification.controller");
const batchCtrl = require("../controllers/batch.controller");
const userCtrl = require("../controllers/user.controller");
const adminCtrl = require("../controllers/admin.controller");
const categoryCtrl = require("../controllers/category.controller");
const bannerCtrl = require("../controllers/banner.controller");
const couponCtrl = require("../controllers/coupon.controller");
const { adminCrudFactory } = require("../controllers/helpers");

const validate = require("../middlewares/validate");
const { auth, optionalAuth, requireRole } = require("../middlewares/auth");
const {
  registerValidator,
  resendVerifyOtpValidator,
  loginValidator,
  verifyOtpValidator,
  productValidator,
  batchValidator,
  couponValidator,
  adminCustomerCreateValidator,
  adminCustomerUpdateValidator,
} = require("../validators");
const { Product, Category, Banner, Coupon, Order, Contact } = require("../models");
const { upload } = require("../middlewares/upload");

const router = express.Router();
const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 24 });

// ─── Health ───────────────────────────────────────────────────────────────────
router.get("/health", authCtrl.health);

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post("/auth/register", registerValidator, validate, authCtrl.register);
router.post(
  "/auth/resend-verify-otp",
  resendVerifyOtpValidator,
  validate,
  authCtrl.resendVerifyOtp
);
router.post("/auth/verify-otp", verifyOtpValidator, validate, authCtrl.verifyOtp);
router.post("/auth/login", loginValidator, validate, authCtrl.login);
router.post("/auth/refresh-token", authCtrl.refreshToken);
router.post("/auth/logout", auth, authCtrl.logout);
router.get("/users/me", auth, authCtrl.me);
router.put("/auth/profile", auth, authCtrl.updateProfile);
router.put("/auth/change-password", auth, authCtrl.changePassword);
router.post("/auth/forgot-password", authCtrl.forgotPassword);
router.post("/auth/reset-password", authCtrl.resetPassword);

// ─── Public catalogue ─────────────────────────────────────────────────────────
router.get("/coupons/active", optionalAuth, orderCtrl.publicCoupons);
router.get("/categories", productCtrl.listCategories);
router.get("/banners", productCtrl.listBanners);
router.get("/products", productCtrl.listProducts);
router.get("/products/:id", productCtrl.productDetail);

// ─── Cart ─────────────────────────────────────────────────────────────────────
router.get("/cart", auth, cartCtrl.getCart);
router.post("/cart/items", auth, cartCtrl.upsertCart);
router.delete("/cart/items/:productId", auth, cartCtrl.removeCartItem);
router.delete("/cart/clear", auth, cartCtrl.clearCart);

// ─── Wishlist ─────────────────────────────────────────────────────────────────
router.get("/wishlist", auth, cartCtrl.getWishlist);
router.post("/wishlist/items", auth, cartCtrl.addWishlist);
router.delete("/wishlist/items/:productId", auth, cartCtrl.removeWishlist);

// ─── Orders ──────────────────────────────────────────────────────────────────
router.post("/checkout/place-order", optionalAuth, orderCtrl.placeOrder);
router.get("/orders/my-orders", auth, orderCtrl.myOrders);
router.get("/orders/:id", auth, orderCtrl.orderDetail);
router.post("/orders/:id/cancel", auth, orderCtrl.cancelOrder);

// ─── Contact ─────────────────────────────────────────────────────────────────
router.post("/contact", contactCtrl.createContact);

// ─── Notifications ───────────────────────────────────────────────────────────
router.get("/notifications", auth, notificationCtrl.getNotifications);
router.patch("/notifications/:id/read", auth, notificationCtrl.markNotificationRead);
router.patch("/notifications/read-all", auth, notificationCtrl.markAllNotificationsRead);

// ─── Chat ─────────────────────────────────────────────────────────────────────
router.post("/chat/session", optionalAuth, chatCtrl.createChatSession);
router.post("/chat/message", chatLimiter, chatCtrl.chatMessage);
router.get("/chat/history/:sessionId", chatCtrl.chatHistory);
router.post("/chat/feedback", chatCtrl.chatFeedback);

// ─── Admin ───────────────────────────────────────────────────────────────────
const admin = express.Router();
admin.use(auth, requireRole("Admin"));

admin.get("/dashboard", adminCtrl.adminDashboard);
admin.get("/near-expiry", batchCtrl.adminNearExpiry);
admin.get("/reports", adminCtrl.adminReports);
admin.post("/check-expiry-notifications", notificationCtrl.triggerExpiryCheck);

admin.get("/products/:id", productCtrl.adminProductById);
admin.get("/products", productCtrl.adminListProducts);
admin.post("/products", productValidator, validate, productCtrl.adminCreateProduct);
admin.put("/products/:id", productCtrl.adminUpdateProduct);
admin.delete("/products/:id", adminCrudFactory(Product));

admin.get("/categories", adminCrudFactory(Category));
admin.post("/categories", categoryCtrl.createCategory);
admin.put("/categories/:id", categoryCtrl.updateCategory);
admin.delete("/categories/:id", adminCrudFactory(Category));

admin.get("/banners", adminCrudFactory(Banner));
admin.post("/banners", bannerCtrl.createBanner);
admin.put("/banners/:id", bannerCtrl.updateBanner);
admin.delete("/banners/:id", adminCrudFactory(Banner));

admin.get("/coupons", adminCrudFactory(Coupon));
admin.post("/coupons", couponValidator, validate, couponCtrl.createCoupon);
admin.put("/coupons/:id", couponValidator, validate, couponCtrl.updateCoupon);
admin.delete("/coupons/:id", adminCrudFactory(Coupon));

admin.post("/upload", upload.single("image"), adminCtrl.uploadImage);
admin.post("/delete-image", adminCtrl.deleteImage);

admin.get("/customers", userCtrl.adminListCustomers);
admin.post("/customers", adminCustomerCreateValidator, validate, userCtrl.adminCreateCustomer);
admin.put("/customers/:id", adminCustomerUpdateValidator, validate, userCtrl.adminUpdateCustomer);
admin.delete("/customers/:id", userCtrl.adminDeleteCustomer);

admin.get("/orders", adminCrudFactory(Order));
admin.put("/orders/:id/status", orderCtrl.adminUpdateOrderStatus);

admin.get("/contacts", contactCtrl.listContacts);
admin.put("/contacts/:id", contactCtrl.updateContact);
admin.delete("/contacts/:id", adminCrudFactory(Contact));

admin.get("/batches", batchCtrl.listBatches);
admin.post("/batches", batchValidator, validate, batchCtrl.createBatch);
admin.put("/batches/:id", batchCtrl.updateBatch);
admin.delete("/batches/:id", batchCtrl.deleteBatch);
admin.patch("/batches/:id/toggle-disabled", batchCtrl.toggleBatchDisabled);

router.use("/admin", admin);

module.exports = router;
