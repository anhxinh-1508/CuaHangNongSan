const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { connectDb } = require("../src/config/db");
const {
  User,
  Category,
  Product,
  ProductBatch,
  Banner,
  Coupon,
  Order,
  Contact,
  InventoryTransaction,
} = require("../src/models");
const { deriveBatchStatus } = require("../src/services/inventory.service");
const { parseExpiryDateVN } = require("../src/utils/vnDate");

const categories = [
  { name: "Rau củ", slug: "rau" },
  { name: "Trái cây", slug: "qua" },
  { name: "Ngũ cốc & Hạt", slug: "ngu-coc" },
  { name: "Đặc sản vùng miền", slug: "dac-san" },
  { name: "Nấm & Rau mầm", slug: "cu" },
  { name: "Gia vị & Thảo mộc", slug: "gia-vi" },
];

function days(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function seed() {
  await connectDb();
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    ProductBatch.deleteMany({}),
    Banner.deleteMany({}),
    Coupon.deleteMany({}),
    Order.deleteMany({}),
    Contact.deleteMany({}),
    InventoryTransaction.deleteMany({}),
  ]);

  const admin = await User.create({
    name: "FreshFarm Admin",
    email: "admin@freshfarmorganic.vn",
    passwordHash: await bcrypt.hash("Admin1234", 10),
    role: "Admin",
    isVerified: true,
  });

  const customer = await User.create({
    name: "Khach Mau",
    email: "customer@freshfarmorganic.vn",
    passwordHash: await bcrypt.hash("Customer123", 10),
    role: "Customer",
    isVerified: true,
    phone: "0912345678",
  });

  const createdCategories = await Category.insertMany(categories.map((c) => ({ ...c, isActive: true })));
  const certPool = [["VietGAP"], ["OCOP"], ["hữu cơ"], ["GlobalGAP"], ["VietGAP", "hữu cơ"]];
  const supplierPool = [
    "HTX Rau sạch Đà Lạt",
    "Công ty CP Nông sản Miền Tây",
    "Hợp tác xã OCOP Sơn La",
    "Nhà vườn Lâm Đồng",
    "Đại lý đặc sản vùng cao",
  ];
  const units = ["kg", "gram", "bo", "tui", "thung"];

  const products = [];
  for (let i = 1; i <= 24; i += 1) {
    const c = createdCategories[i % createdCategories.length];
    products.push({
      name: `Nong san ${i}`,
      slug: `nong-san-${i}`,
      description: `San pham nong san ${i}`,
      categoryId: c._id,
      images: [{ secure_url: "https://placehold.co/600x400?text=FreshFarm+Organic", public_id: `seed-${i}` }],
      supplier: supplierPool[i % supplierPool.length],
      certifications: certPool[i % certPool.length],
      unit: units[i % units.length],
      price: 20000 + i * 3500,
      salePrice: i % 3 === 0 ? 18000 + i * 3000 : null,
      ratingAvg: 4 + (i % 10) / 20,
      soldCount: 50 + i * 2,
      isActive: true,
    });
  }
  const createdProducts = await Product.insertMany(products);

  const batches = [];
  for (const p of createdProducts) {
    for (let n = 0; n < 2; n += 1) {
      const expiryDate = parseExpiryDateVN(days(4 + ((n + p.name.length) % 20)));
      const quantity = 20 + ((n + p.slug.length) % 35);
      batches.push({
        productId: p._id,
        batchCode: `BATCH-${p.slug}-${n + 1}`,
        harvestDate: days(-7 - n),
        packingDate: days(-4 - n),
        expiryDate,
        quantityInStock: quantity,
        importPrice: Math.round((p.price || 30000) * 0.6),
        status: deriveBatchStatus(expiryDate, quantity),
      });
    }
  }
  await ProductBatch.insertMany(batches);

  await Banner.insertMany([
    { title: "Tuoi moi moi ngay", image: { secure_url: "https://placehold.co/1200x400?text=Banner+1", public_id: "b1" }, isActive: true },
    { title: "Uu dai cuoi tuan", image: { secure_url: "https://placehold.co/1200x400?text=Banner+2", public_id: "b2" }, isActive: true },
  ]);

  await Coupon.insertMany([
    {
      code: "FRESH10",
      discountType: "PERCENT",
      discountValue: 10,
      minOrderValue: 100000,
      startAt: days(-7),
      endAt: days(30),
      usageLimit: 500,
      perUserLimit: 3,
      isActive: true,
    },
    {
      code: "SAVE30000",
      discountType: "FIXED",
      discountValue: 30000,
      minOrderValue: 250000,
      startAt: days(-7),
      endAt: days(30),
      usageLimit: 200,
      perUserLimit: 2,
      isActive: true,
    },
  ]);

  const sampleProduct = createdProducts[0];
  await Order.create({
    orderCode: `NS-SAMPLE-${Date.now()}`,
    userId: customer._id,
    shippingAddress: {
      receiverName: "Khach Mau",
      receiverPhone: "0912345678",
      province: "HCM",
      district: "Quan 1",
      ward: "Ben Nghe",
      addressLine: "123 Nguyen Hue",
    },
    paymentMethod: "CashOnDelivery",
    status: "Delivered",
    items: [
      {
        productId: sampleProduct._id,
        productName: sampleProduct.name,
        productImage: sampleProduct.images[0].secure_url,
        unit: sampleProduct.unit,
        supplier: sampleProduct.supplier,
        unitPrice: sampleProduct.price,
        quantity: 2,
        subtotal: sampleProduct.price * 2,
        batchCode: "",
      },
    ],
    subtotal: sampleProduct.price * 2,
    discount: 0,
    shippingFee: 20000,
    total: sampleProduct.price * 2 + 20000,
    allocations: [],
  });

  await Contact.create({
    name: "Nguyen Van A",
    email: "a@example.com",
    subject: "Hoi ve don hang",
    message: "Toi can ho tro giao nhanh trong ngay.",
    status: "Unread",
  });

  // eslint-disable-next-line no-console
  console.log("Seed done.");
  // eslint-disable-next-line no-console
  console.log("Admin:", "admin@freshfarmorganic.vn / Admin1234");
  // eslint-disable-next-line no-console
  console.log("Customer:", "customer@freshfarmorganic.vn / Customer123");
  await mongoose.connection.close();
}

seed().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed", err);
  await mongoose.connection.close();
  process.exit(1);
});
