/**
 * Chuẩn hoá chuỗi tiếng Việt để tìm không dấu (chữ thường, ASCII gần đúng).
 * Dùng NFD + gỡ mọi ký tự kết hợp (\p{M}) — khớp ư/ơ/đ, dấu mũ, v.v. đáng tin cậy hơn danh sách tay.
 */
function removeVietnameseTones(str) {
  if (str == null || typeof str !== "string") return "";
  let s = str.toLowerCase().trim();
  if (!s) return "";
  s = s.normalize("NFD").replace(/\p{M}+/gu, "");
  s = s.replace(/\u0111/g, "d").replace(/\u0110/g, "d");
  return s.replace(/\s+/g, " ").trim();
}

/** Tách query thành các từ (đã bỏ dấu), bỏ rỗng */
function searchTokenParts(query) {
  return removeVietnameseTones(query)
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function certificationsSearchFold(arr) {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((c) => removeVietnameseTones(String(c)))
    .filter(Boolean)
    .join(" ")
    .trim();
}

module.exports = {
  removeVietnameseTones,
  searchTokenParts,
  escapeRegex,
  certificationsSearchFold,
};
