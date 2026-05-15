import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import {
  getDistrictsByProvinceCode,
  getProvinces,
  getWardsByDistrictCode,
} from 'vn-provinces'

export type VietnamAddressCodes = {
  provinceCode: string
  districtCode: string
  wardCode: string
}

type Row = { code: string; name: string }

function asRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return []
  return data.filter(
    (x): x is Row => Boolean(x) && typeof x === 'object' && typeof (x as Row).code === 'string'
  )
}

export function resolveVietnamAddressNames(codes: VietnamAddressCodes): {
  province: string
  district: string
  ward: string
} {
  const provinces = asRows(getProvinces())
  const p = provinces.find((x) => x.code === codes.provinceCode)
  const districts = asRows(getDistrictsByProvinceCode(codes.provinceCode))
  const d = districts.find((x) => x.code === codes.districtCode)
  const wards = asRows(getWardsByDistrictCode(codes.districtCode))
  const w = wards.find((x) => x.code === codes.wardCode)
  return {
    province: p?.name ?? '',
    district: d?.name ?? '',
    ward: w?.name ?? '',
  }
}

function selectStyle(invalid: boolean, disabled?: boolean): CSSProperties {
  return {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    border: invalid ? '2px solid #dc2626' : '2px solid #e7e5e4',
    fontSize: 14,
    outline: 'none',
    marginBottom: 4,
    boxSizing: 'border-box',
    background: '#fff',
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

export default function VietnamAddressFields({
  value,
  onChange,
  errors,
}: {
  value: VietnamAddressCodes
  onChange: (next: VietnamAddressCodes) => void
  errors?: Partial<Record<'province' | 'district' | 'ward', string>>
}) {
  const provinces = useMemo(() => asRows(getProvinces()), [])
  const districts = useMemo(
    () => asRows(getDistrictsByProvinceCode(value.provinceCode)),
    [value.provinceCode]
  )
  const wards = useMemo(
    () => asRows(getWardsByDistrictCode(value.districtCode)),
    [value.districtCode]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#3C5C2D' }}>
          Tỉnh / Thành phố <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <select
          value={value.provinceCode}
          onChange={(e) => {
            const provinceCode = e.target.value
            onChange({ provinceCode, districtCode: '', wardCode: '' })
          }}
          aria-invalid={Boolean(errors?.province)}
          style={selectStyle(Boolean(errors?.province))}
        >
          <option value="">-- Chọn tỉnh/thành --</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
        {errors?.province && (
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#dc2626' }}>{errors.province}</p>
        )}
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#3C5C2D' }}>
          Quận / Huyện <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <select
          value={value.districtCode}
          disabled={!value.provinceCode}
          onChange={(e) => {
            const districtCode = e.target.value
            onChange({ ...value, districtCode, wardCode: '' })
          }}
          aria-invalid={Boolean(errors?.district)}
          style={selectStyle(Boolean(errors?.district), !value.provinceCode)}
        >
          <option value="">-- Chọn quận/huyện --</option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
        {errors?.district && (
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#dc2626' }}>{errors.district}</p>
        )}
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#3C5C2D' }}>
          Phường / Xã <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <select
          value={value.wardCode}
          disabled={!value.districtCode}
          onChange={(e) => onChange({ ...value, wardCode: e.target.value })}
          aria-invalid={Boolean(errors?.ward)}
          style={selectStyle(Boolean(errors?.ward), !value.districtCode)}
        >
          <option value="">-- Chọn phường/xã --</option>
          {wards.map((w) => (
            <option key={w.code} value={w.code}>
              {w.name}
            </option>
          ))}
        </select>
        {errors?.ward && (
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#dc2626' }}>{errors.ward}</p>
        )}
      </div>
    </div>
  )
}
