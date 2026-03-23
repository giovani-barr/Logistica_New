import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useRaioX } from '../../context/RaioXContext'

function pivotize(data, rowField, colField, valueField, aggregation) {
  if (!rowField || !colField || !valueField || !data.length) {
    return { rows: [], cols: [], cells: {} }
  }
  const rowKeys = [...new Set(data.map(r => String(r[rowField] ?? '—')))]
  const colKeys = [...new Set(data.map(r => String(r[colField] ?? '—')))]

  const groups = {}
  data.forEach(r => {
    const rk = String(r[rowField] ?? '—')
    const ck = String(r[colField] ?? '—')
    const key = `${rk}||${ck}`
    if (!groups[key]) groups[key] = []
    groups[key].push(r[valueField])
  })

  const cells = {}
  Object.entries(groups).forEach(([key, vals]) => {
    const nums = vals.map(v => parseFloat(v)).filter(v => !isNaN(v))
    let result
    switch (aggregation) {
      case 'sum':   result = nums.reduce((a, b) => a + b, 0); break
      case 'avg':   result = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; break
      case 'max':   result = nums.length ? Math.max(...nums) : null; break
      case 'min':   result = nums.length ? Math.min(...nums) : null; break
      default:      result = vals.length // count
    }
    cells[key] = result
  })

  return { rows: rowKeys, cols: colKeys, cells }
}

export default function PivotTable({ data, config, expanded = false }) {
  const { theme } = useRaioX()
  const dark = theme === 'dark'

  const cols = useMemo(() => data.length ? Object.keys(data[0]) : [], [data])

  const [rowField,    setRowField]    = useState(config?.row_field    || cols[0] || '')
  const [colField,    setColField]    = useState(config?.col_field    || cols[1] || '')
  const [valueField,  setValueField]  = useState(config?.value_field  || cols[2] || '')
  const [aggregation, setAggregation] = useState(config?.agregacao    || 'count')
  const [search,      setSearch]      = useState('')

  const { rows, cols: pivotCols, cells } = useMemo(
    () => pivotize(data, rowField, colField, valueField, aggregation),
    [data, rowField, colField, valueField, aggregation]
  )

  const filteredRows = useMemo(
    () => search ? rows.filter(r => r.toLowerCase().includes(search.toLowerCase())) : rows,
    [rows, search]
  )

  const grandTotal = filteredRows.reduce(
    (sum, rk) => sum + pivotCols.reduce((s, ck) => s + (cells[`${rk}||${ck}`] ?? 0), 0), 0
  )

  const fmt = (v) => {
    if (v == null) return '—'
    if (typeof v === 'number') {
      if (!Number.isInteger(v)) return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return v.toLocaleString('pt-BR')
    }
    return String(v)
  }

  const selectCls = `rounded border ${expanded ? 'px-2.5 py-1.5 text-sm' : 'px-2 py-1 text-xs'} outline-none ${dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`

  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-sm text-slate-500">Sem dados</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* controles */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <select value={rowField}    onChange={e => setRowField(e.target.value)}    className={selectCls} title="Campo das linhas">
          <option value="">— Linhas —</option>
          {cols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-slate-400">×</span>
        <select value={colField}    onChange={e => setColField(e.target.value)}    className={selectCls} title="Campo das colunas">
          <option value="">— Colunas —</option>
          {cols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-slate-400">=</span>
        <select value={valueField}  onChange={e => setValueField(e.target.value)}  className={selectCls} title="Campo de valor">
          <option value="">— Valor —</option>
          {cols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={aggregation} onChange={e => setAggregation(e.target.value)} className={selectCls}>
          <option value="count">Contagem</option>
          <option value="sum">Soma</option>
          <option value="avg">Média</option>
          <option value="max">Máximo</option>
          <option value="min">Mínimo</option>
        </select>
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar linhas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${selectCls} pl-6 ${expanded ? 'w-56' : 'w-36'}`}
          />
        </div>
      </div>

      {(!rowField || !colField || !valueField) ? (
        <div className="flex items-center justify-center flex-1 text-sm text-slate-500">
          Selecione os campos de linha, coluna e valor
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border" style={{ minHeight: 0 }}>
          <table className={`border-collapse w-max min-w-full ${expanded ? 'text-sm' : 'text-xs'}`}>
            <thead className={`sticky top-0 z-10 ${dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <tr>
                <th className={`sticky left-0 z-20 px-3 py-2 text-left font-semibold border-b border-r whitespace-nowrap ${dark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {rowField}&nbsp;↓&nbsp;/&nbsp;{colField}&nbsp;→
                </th>
                {pivotCols.map(ck => (
                  <th key={ck} className={`px-3 py-2 text-right font-semibold border-b whitespace-nowrap ${dark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    {ck}
                  </th>
                ))}
                <th className={`px-3 py-2 text-right font-semibold border-b border-l ${dark ? 'border-slate-700 text-blue-400' : 'border-slate-200 text-blue-600'}`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((rk, ri) => {
                const rowTotal = pivotCols.reduce((sum, ck) => sum + (cells[`${rk}||${ck}`] ?? 0), 0)
                return (
                  <tr key={rk} className={dark
                    ? (ri % 2 ? 'bg-slate-800/30' : '') + ' hover:bg-slate-700/30'
                    : (ri % 2 ? 'bg-slate-50/50' : '') + ' hover:bg-blue-50/40'
                  }>
                    <td className={`sticky left-0 px-3 py-2 font-medium border-r whitespace-nowrap ${dark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                      {rk}
                    </td>
                    {pivotCols.map(ck => (
                      <td key={ck} className={`px-3 py-2 text-right ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {fmt(cells[`${rk}||${ck}`] ?? null)}
                      </td>
                    ))}
                    <td className={`px-3 py-2 text-right font-semibold border-l ${dark ? 'text-blue-400 border-slate-700' : 'text-blue-600 border-slate-200'}`}>
                      {fmt(rowTotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className={`sticky bottom-0 ${dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <tr>
                <td className={`sticky left-0 px-3 py-2 font-semibold border-t border-r ${dark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-200 text-blue-600'}`}>
                  Total
                </td>
                {pivotCols.map(ck => {
                  const colTotal = filteredRows.reduce((sum, rk) => sum + (cells[`${rk}||${ck}`] ?? 0), 0)
                  return (
                    <td key={ck} className={`px-3 py-2 text-right font-semibold border-t ${dark ? 'text-blue-400 border-slate-700' : 'text-blue-600 border-slate-200'}`}>
                      {fmt(colTotal)}
                    </td>
                  )
                })}
                <td className={`px-3 py-2 text-right font-bold border-t border-l ${dark ? 'text-blue-300 border-slate-700' : 'text-blue-700 border-slate-200'}`}>
                  {fmt(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
