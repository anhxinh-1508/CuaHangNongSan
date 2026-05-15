/**
 * Ngày/giờ theo múi Việt Nam (UTC+7, IANA Asia/Ho_Chi_Minh).
 * MongoDB vẫn lưu Date dạng UTC — đây là cách chuẩn; dùng các hàm này để gom nhóm / lọc theo "ngày lịch" VN.
 */

const VN_IANA = "Asia/Ho_Chi_Minh";

const fmtYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_IANA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** @param {Date} date */
function dateKeyVN(date) {
  return fmtYmd.format(date);
}

/** YYYY-MM-DD → 00:00:00.000 theo giờ VN */
function startOfDayVN(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return new Date(NaN);
  return new Date(`${ymd}T00:00:00+07:00`);
}

/** YYYY-MM-DD → 23:59:59.999 theo giờ VN */
function endOfDayVN(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return new Date(NaN);
  return new Date(`${ymd}T23:59:59.999+07:00`);
}

function startOfTodayVN() {
  return startOfDayVN(dateKeyVN(new Date()));
}

function endOfTodayVN() {
  return endOfDayVN(dateKeyVN(new Date()));
}

/** Lùi / tiến N ngào theo lịch VN (không DST tại VN). */
function addCalendarDaysVN(ymd, deltaDays) {
  const t = startOfDayVN(ymd);
  if (Number.isNaN(t.getTime())) return ymd;
  const u = new Date(t.getTime() + deltaDays * 86400000);
  return dateKeyVN(u);
}

module.exports = {
  VN_IANA,
  dateKeyVN,
  startOfDayVN,
  endOfDayVN,
  startOfTodayVN,
  endOfTodayVN,
  addCalendarDaysVN,
};
