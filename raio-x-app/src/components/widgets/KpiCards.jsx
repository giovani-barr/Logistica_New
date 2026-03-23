import { useRaioX } from '../../context/RaioXContext'
import { toNumber } from '../../utils/valueFormatting'

export default function KpiCards({ data, config, abaId, expanded = false }) {
  const { theme } = useRaioX()
  const dark = theme === 'dark'

  if (!config?.length) return null

  const kpis = config.map(kpi => {
    const { coluna, agregacao, label } = kpi
    const rawVals = data.map(r => r[coluna])
    const nums = rawVals.map(v => toNumber(v)).filter(v => v != null)
    let value
    switch (agregacao) {
      case 'count':  value = data.length; break
      case 'sum':    value = nums.reduce((a, b) => a + b, 0); break
      case 'avg':    value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break
      case 'max':    value = nums.length ? Math.max(...nums) : null; break
      case 'min':    value = nums.length ? Math.min(...nums) : null; break
      case 'first':  value = rawVals.find(v => v != null) ?? null; break
      case 'last': {
        const nonNull = rawVals.filter(v => v != null)
        value = nonNull.length ? nonNull[nonNull.length - 1] : null; break
      }
      case 'unique': value = new Set(rawVals.filter(v => v != null)).size; break
      case 'concat': {
        const uniq = [...new Set(rawVals.filter(v => v != null).map(String))]
        value = uniq.slice(0, 8).join(', ') + (uniq.length > 8 ? `… +${uniq.length - 8}` : ''); break
      }
      default: value = null
    }
    return {
      label: label || `${agregacao.toUpperCase()} ${coluna}`,
      value,
      sub: agregacao === 'count' || agregacao === 'unique' ? 'registros' : coluna,
    }
  })

  const fmt = (v) => {
    if (v == null) return '—'
    if (typeof v === 'number' && !Number.isInteger(v)) return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (typeof v === 'number') return v.toLocaleString('pt-BR')
    return String(v)
  }

  return (
    <div className={`flex flex-wrap ${expanded ? 'gap-4' : 'gap-3'}`}>
      {kpis.map((k, i) => {
        const isText = typeof k.value === 'string' && k.value.length > 8
        return (
          <div key={i} className={`flex-1 ${expanded ? 'min-w-[220px] p-4.5' : 'min-w-[140px] p-3.5'} rounded-xl border ${
            dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`${expanded ? 'text-xs mb-1.5' : 'text-[11px] mb-1'} font-semibold uppercase tracking-wider text-slate-500`}>{k.label}</div>
            <div className={`font-bold leading-tight ${isText ? (expanded ? 'text-base break-words' : 'text-sm break-words') : (expanded ? 'text-3xl' : 'text-2xl')} ${dark ? 'text-white' : 'text-slate-800'}`}>
              {fmt(k.value)}
            </div>
            <div className={`${expanded ? 'text-xs mt-1' : 'text-[10px] mt-0.5'} text-slate-400`}>{k.sub}</div>
          </div>
        )
      })}
    </div>
  )
}
