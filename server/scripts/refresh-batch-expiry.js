/**
 * Gia hạn HSD các lô đã Expired nhưng còn quantityInStock > 0 (dev/demo).
 * Chạy: node scripts/refresh-batch-expiry.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../src/config/db");
const { ProductBatch } = require("../src/models");
const { deriveBatchStatus } = require("../src/services/inventory.service");
const { endOfVnDay, vnDateKey, parseExpiryDateVN, isExpiryStillValid } = require("../src/utils/vnDate");

function daysFromNow(n) {
  const key = vnDateKey(new Date(Date.now() + n * 24 * 60 * 60 * 1000));
  return parseExpiryDateVN(key);
}

async function main() {
  await connectDb();
  const batches = await ProductBatch.find({});
  let updated = 0;
  for (const b of batches) {
    let changed = false;
    const normalized = endOfVnDay(b.expiryDate);
    if (normalized.getTime() !== new Date(b.expiryDate).getTime()) {
      b.expiryDate = normalized;
      changed = true;
    }
    if (!isExpiryStillValid(b.expiryDate) && b.quantityInStock > 0 && !b.isDisabled) {
      b.expiryDate = daysFromNow(14 + (b.batchCode?.length ?? 0) % 30);
      changed = true;
    }
    const nextStatus = deriveBatchStatus(b.expiryDate, b.quantityInStock);
    if (b.status !== nextStatus) {
      b.status = nextStatus;
      changed = true;
    }
    if (!changed) continue;
    await b.save();
    updated += 1;
  }
  console.log(`Đã cập nhật ${updated}/${batches.length} lô (HSD mới + trạng thái).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
