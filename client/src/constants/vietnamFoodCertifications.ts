/**
 * Danh mục chứng nhận / tiêu chí phổ biến cho nông sản & thực phẩm tại Việt Nam
 * (dùng checklist admin; giá trị `value` lưu DB và query lọc sản phẩm).
 */
export type VietnamFoodCertOption = {
  value: string
  label: string
  hint?: string
}

export const VIETNAM_FOOD_CERTIFICATION_OPTIONS: VietnamFoodCertOption[] = [
  {
    value: 'VietGAP',
    label: 'VietGAP',
    hint: 'Thực hành sản xuất nông nghiệp tốt Việt Nam (Bộ NN&PTNT).',
  },
  {
    value: 'GlobalGAP',
    label: 'GlobalGAP',
    hint: 'Tiêu chuẩn thực hành nông nghiệp tốt toàn cầu (IFA).',
  },
  {
    value: 'OCOP',
    label: 'OCOP',
    hint: 'Chương trình Mỗi xã một sản phẩm (Bộ NN&PTNT).',
  },
  {
    value: 'hữu cơ',
    label: 'Hữu cơ',
    hint: 'Sản xuất theo quy định hữu cơ Việt Nam / chứng nhận organic tương đương.',
  },
  {
    value: 'HACCP',
    label: 'HACCP',
    hint: 'Hệ thống phân tích mối nguy & điểm kiểm soát tới hạn.',
  },
  {
    value: 'ISO 22000',
    label: 'ISO 22000',
    hint: 'Hệ thống quản lý an toàn thực phẩm.',
  },
  {
    value: 'ISO 9001',
    label: 'ISO 9001',
    hint: 'Hệ thống quản lý chất lượng.',
  },
  {
    value: 'ATTP',
    label: 'ATTP / cơ sở đủ điều kiện',
    hint: 'Giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm (Bộ Y tế / địa phương).',
  },
  {
    value: 'Halal',
    label: 'Halal',
    hint: 'Phù hợp quy định Hồi giáo.',
  },
  {
    value: 'Kosher',
    label: 'Kosher',
    hint: 'Phù hợp quy định Do Thái giáo.',
  },
  {
    value: 'Truy xuất nguồn gốc',
    label: 'Truy xuất nguồn gốc',
    hint: 'Có hệ thống truy xuất (mã vạch, QR, blockchain…).',
  },
  {
    value: 'USDA Organic',
    label: 'USDA Organic',
    hint: 'Chứng nhận hữu cơ Hoa Kỳ.',
  },
  {
    value: 'EU Organic',
    label: 'EU Organic',
    hint: 'Chứng nhận hữu cơ Liên minh châu Âu.',
  },
  {
    value: 'JAS Organic',
    label: 'JAS Organic',
    hint: 'Tiêu chuẩn hữu cơ Nhật Bản (xuất khẩu).',
  },
  {
    value: 'BRC',
    label: 'BRC',
    hint: 'Tiêu chuẩn an toàn thực phẩm của Hiệp hội bán lẻ Anh.',
  },
]

const CANONICAL_BY_LOWER = new Map(
  VIETNAM_FOOD_CERTIFICATION_OPTIONS.map((o) => [o.value.toLowerCase(), o.value])
)

/** Chuẩn hóa chuỗi trong DB về đúng `value` trong danh sách (không phân biệt hoa thường). */
export function toCanonicalCertValue(raw: string): string | null {
  const key = String(raw ?? '').trim().toLowerCase()
  if (!key) return null
  return CANONICAL_BY_LOWER.get(key) ?? null
}
