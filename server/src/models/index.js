const mongoose = require("mongoose");
const { removeVietnameseTones, certificationsSearchFold } = require("../utils/viFold");

const imageSchema = new mongoose.Schema(
  {
    secure_url: String,
    public_id: String,
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    receiverName: { type: String, required: true, trim: true },
    receiverPhone: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    ward: { type: String, required: true, trim: true },
    addressLine: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Admin", "Customer"], default: "Customer" },
    phone: { type: String, trim: true, default: "" },
    isVerified: { type: Boolean, default: false },
    refreshToken: { type: String, default: "" },
  },
  { timestamps: true }
);

const otpVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    otp: { type: String, required: true },
    type: { type: String, enum: ["VERIFY_EMAIL", "RESET_PASSWORD"], required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    images: { type: [imageSchema], default: [] },
    supplier: { type: String, required: true, trim: true },
    certifications: { type: [String], default: [] },
    unit: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null },
    ratingAvg: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    /** Trường phục vụ tìm không dấu / từng từ (Shop) */
    nameNormalized: { type: String, default: "", index: true },
    supplierNormalized: { type: String, default: "", index: true },
    certificationsSearch: { type: String, default: "", index: true },
    descriptionNormalized: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

productSchema.pre("save", async function () {
  this.nameNormalized = removeVietnameseTones(this.name || "");
  this.supplierNormalized = removeVietnameseTones(this.supplier || "");
  this.descriptionNormalized = removeVietnameseTones(this.description || "");
  this.certificationsSearch = certificationsSearchFold(this.certifications || []);
});

productSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate();
  if (!update || typeof update !== "object") return;
  const plain = update.$set != null ? { ...update.$set } : { ...update };
  const extra = {};
  if (plain.name !== undefined) extra.nameNormalized = removeVietnameseTones(String(plain.name));
  if (plain.supplier !== undefined) extra.supplierNormalized = removeVietnameseTones(String(plain.supplier));
  if (plain.description !== undefined) extra.descriptionNormalized = removeVietnameseTones(String(plain.description));
  if (plain.certifications !== undefined) extra.certificationsSearch = certificationsSearchFold(plain.certifications);
  if (Object.keys(extra).length === 0) return;
  if (update.$set != null) {
    this.setUpdate({ ...update, $set: { ...update.$set, ...extra } });
  } else {
    this.setUpdate({ ...update, $set: { ...plain, ...extra } });
  }
});

const productBatchSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchCode: { type: String, required: true, unique: true, trim: true },
    harvestDate: { type: Date, required: true },
    packingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    quantityInStock: { type: Number, required: true, min: 0 },
    importPrice: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["Active", "NearExpiry", "Expired", "OutOfStock"], default: "Active" },
    isDisabled: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const inventoryTransactionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductBatch", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    type: { type: String, enum: ["IMPORT", "ALLOCATE", "RESTORE", "ADJUST"], required: true },
    quantity: { type: Number, required: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    image: imageSchema,
    link: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    productName: String,
    productImage: String,
    unit: String,
    supplier: String,
    originProvince: String, // legacy orders only
    unitPrice: Number,
    quantity: Number,
    subtotal: Number,
    batchCode: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guestInfo: {
      name: String,
      email: String,
      phone: String,
    },
    shippingAddress: addressSchema,
    note: { type: String, default: "" },
    receivingTimeSlot: { type: String, default: "" },
    paymentMethod: {
      type: String,
      enum: ["CashOnDelivery", "BankTransfer", "CreditCard", "Ewallet"],
      default: "CashOnDelivery",
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Packing", "Shipping", "Delivered", "DeliveryFailed", "RetryDelivery", "Cancelled"],
      default: "Pending",
    },
    items: [orderItemSchema],
    subtotal: Number,
    discount: Number,
    shippingFee: Number,
    total: Number,
    couponCode: String,
    allocations: [
      {
        productId: mongoose.Schema.Types.ObjectId,
        batchId: mongoose.Schema.Types.ObjectId,
        quantity: Number,
      },
    ],
  },
  { timestamps: true }
);

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, unique: true },
    discountType: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    usageLimit: { type: Number, default: 100 },
    perUserLimit: { type: Number, default: 2 },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["Unread", "Read", "Contacted", "Resolved", "Failed"], default: "Unread" },
    internalNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guestId: { type: String, default: "" },
    title: { type: String, default: "Tư vấn nông sản" },
  },
  { timestamps: true }
);

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatSession", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    structured: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "ORDER_STATUS",
        "NEW_ORDER",
        "BATCH_NEAR_EXPIRY",
        "BATCH_EXPIRED",
        "COUPON_NEAR_EXPIRY",
        "COUPON_EXPIRED",
        "NEW_CONTACT",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: "" },
    isRead: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const couponUsageSchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const OtpVerification = mongoose.model("OtpVerification", otpVerificationSchema);
const Category = mongoose.model("Category", categorySchema);
const Product = mongoose.model("Product", productSchema);
const ProductBatch = mongoose.model("ProductBatch", productBatchSchema);
const InventoryTransaction = mongoose.model("InventoryTransaction", inventoryTransactionSchema);
const Banner = mongoose.model("Banner", bannerSchema);
const Cart = mongoose.model("Cart", cartSchema);
const Wishlist = mongoose.model("Wishlist", wishlistSchema);
const Order = mongoose.model("Order", orderSchema);
const Coupon = mongoose.model("Coupon", couponSchema);
const Contact = mongoose.model("Contact", contactSchema);
const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
const CouponUsage = mongoose.model("CouponUsage", couponUsageSchema);
const Notification = mongoose.model("Notification", notificationSchema);

module.exports = {
  User,
  OtpVerification,
  Category,
  Product,
  ProductBatch,
  InventoryTransaction,
  Banner,
  Cart,
  Wishlist,
  Order,
  Coupon,
  Contact,
  ChatSession,
  ChatMessage,
  CouponUsage,
  Notification,
};
