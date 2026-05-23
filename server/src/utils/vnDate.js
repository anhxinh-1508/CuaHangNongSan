const VN_TZ = "Asia/Ho_Chi_Minh";

/** YYYY-MM-DD theo lịch Việt Nam */
function vnDateKey(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(new Date(d));
}

/** Cuối ngày (23:59:59.999) theo giờ VN — HSD «đến hết ngày DD/MM/YYYY». */
function endOfVnDay(d) {
  const key = vnDateKey(d);
  return new Date(`${key}T23:59:59.999+07:00`);
}

/** Đầu ngày hôm nay theo giờ VN */
function startOfTodayVn() {
  const key = vnDateKey(new Date());
  return new Date(`${key}T00:00:00+07:00`);
}

/**
 * Chuẩn hóa input từ form (date / ISO) → lưu cuối ngày VN.
 * Admin chọn 23/05/2026 nghĩa là còn hạn đến hết ngày đó.
 */
function parseExpiryDateVN(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return endOfVnDay(input);
  }
  const raw = String(input).trim();
  const day = raw.includes("T") ? raw.split("T")[0] : raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) return null;
    return endOfVnDay(fallback);
  }
  return new Date(`${day}T23:59:59.999+07:00`);
}

/** Còn trong hạn bán (theo lịch VN, tính đến hết ngày HSD). */
function isExpiryStillValid(expiryDate) {
  if (!expiryDate) return false;
  return Date.now() <= endOfVnDay(expiryDate).getTime();
}

/** Số ngày còn lại (lịch VN): 0 = hết hạn trong hôm nay vẫn còn bán. */
function vnDaysUntilExpiry(expiryDate) {
  const today = vnDateKey(new Date());
  const exp = vnDateKey(expiryDate);
  const t0 = new Date(`${today}T12:00:00+07:00`).getTime();
  const t1 = new Date(`${exp}T12:00:00+07:00`).getTime();
  return Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
}

module.exports = {
  VN_TZ,
  vnDateKey,
  endOfVnDay,
  startOfTodayVn,
  parseExpiryDateVN,
  isExpiryStillValid,
  vnDaysUntilExpiry,
};
