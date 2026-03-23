export const VALUE_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Dinheiro' },
  { value: 'date', label: 'Data' },
  { value: 'percent', label: 'Percentual' },
]

export const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Esquerda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Direita' },
]

export const VERTICAL_ALIGN_OPTIONS = [
  { value: 'top', label: 'Topo' },
  { value: 'middle', label: 'Meio' },
  { value: 'bottom', label: 'Base' },
]

export const FONT_SIZE_PRESETS = [
  { value: 'xs', label: 'PP', size: 12, expandedSize: 14 },
  { value: 'sm', label: 'P', size: 14, expandedSize: 16 },
  { value: 'base', label: 'M', size: 16, expandedSize: 20 },
  { value: 'lg', label: 'G', size: 18, expandedSize: 24 },
  { value: 'xl', label: 'GG', size: 22, expandedSize: 30 },
  { value: '2xl', label: 'XG', size: 28, expandedSize: 38 },
  { value: '4xl', label: 'XXG', size: 36, expandedSize: 52 },
]

function toNumber(raw) {
  if (raw == null || raw === '') return null
  const normalized = String(raw).replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveFontSize(preset = '2xl', customPx = null, expanded = false) {
  const parsedCustom = Number(customPx)
  if (Number.isFinite(parsedCustom) && parsedCustom > 0) {
    return expanded ? Math.round(parsedCustom * 1.18) : parsedCustom
  }
  const found = FONT_SIZE_PRESETS.find((item) => item.value === preset) || FONT_SIZE_PRESETS[5]
  return expanded ? found.expandedSize : found.size
}

export function formatValue(raw, format = 'auto', options = {}) {
  const { decimals = null, prefix = '', suffix = '' } = options

  if (raw == null || raw === '') return '—'
  if (format === 'text') return `${prefix}${String(raw)}${suffix}`

  if (format === 'date') {
    const str = String(raw)
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
    const out = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : str
    return `${prefix}${out}${suffix}`
  }

  const num = toNumber(raw)

  if (format === 'currency') {
    if (num == null) return `${prefix}${String(raw)}${suffix}`
    return `${prefix}${num.toLocaleString('pt-BR', { minimumFractionDigits: decimals ?? 2, maximumFractionDigits: decimals ?? 2 })}${suffix}`
  }

  if (format === 'number') {
    if (num == null) return `${prefix}${String(raw)}${suffix}`
    const fixed = decimals == null
      ? (Number.isInteger(num) ? 0 : 2)
      : decimals
    return `${prefix}${num.toLocaleString('pt-BR', { minimumFractionDigits: fixed, maximumFractionDigits: fixed })}${suffix}`
  }

  if (format === 'percent') {
    if (num == null) return `${prefix}${String(raw)}${suffix}`
    const fixed = decimals == null ? 2 : decimals
    return `${prefix}${num.toLocaleString('pt-BR', { minimumFractionDigits: fixed, maximumFractionDigits: fixed })}%${suffix}`
  }

  if (format === 'auto') {
    const str = String(raw)
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${prefix}${iso[3]}/${iso[2]}/${iso[1]}${suffix}`
    if (num != null) {
      const fixed = decimals == null
        ? (Number.isInteger(num) ? 0 : 2)
        : decimals
      return `${prefix}${num.toLocaleString('pt-BR', { minimumFractionDigits: fixed, maximumFractionDigits: fixed })}${suffix}`
    }
    return `${prefix}${str}${suffix}`
  }

  return `${prefix}${String(raw)}${suffix}`
}
