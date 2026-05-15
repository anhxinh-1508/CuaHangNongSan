const { Product } = require("../models");
const { removeVietnameseTones, certificationsSearchFold } = require("../utils/viFold");

const BATCH = 400;

/**
 * Đồng bộ các trường *_Normalized với thuật toán hiện tại (sửa dữ liệu cũ / insertMany / đổi cách bỏ dấu).
 */
async function backfillProductSearchFields() {
  let skip = 0;
  let fixed = 0;
  for (;;) {
    const docs = await Product.find({})
      .select(
        "_id name supplier certifications description nameNormalized supplierNormalized certificationsSearch descriptionNormalized"
      )
      .skip(skip)
      .limit(BATCH)
      .lean();
    if (!docs.length) break;

    const ops = [];
    for (const d of docs) {
      const nn = removeVietnameseTones(d.name || "");
      const sn = removeVietnameseTones(d.supplier || "");
      const cs = certificationsSearchFold(d.certifications || []);
      const dn = removeVietnameseTones(d.description || "");
      if (
        nn !== String(d.nameNormalized ?? "") ||
        sn !== String(d.supplierNormalized ?? "") ||
        cs !== String(d.certificationsSearch ?? "") ||
        dn !== String(d.descriptionNormalized ?? "")
      ) {
        ops.push({
          updateOne: {
            filter: { _id: d._id },
            update: {
              $set: {
                nameNormalized: nn,
                supplierNormalized: sn,
                certificationsSearch: cs,
                descriptionNormalized: dn,
              },
            },
          },
        });
      }
    }
    if (ops.length) {
      await Product.bulkWrite(ops);
      fixed += ops.length;
    }
    skip += BATCH;
    if (docs.length < BATCH) break;
  }
  if (fixed > 0) {
    // eslint-disable-next-line no-console
    console.log(`[product-search] Đã đồng bộ ${fixed} sản phẩm (tìm không dấu: tên, mô tả, NCC…).`);
  }
}

module.exports = { backfillProductSearchFields };
