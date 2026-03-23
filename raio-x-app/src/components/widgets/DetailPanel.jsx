import { useRaioX } from '../../context/RaioXContext'
import { formatValue, resolveFontSize } from '../../utils/valueFormatting'

function getColor(raw, cell) {
  if (cell.cor_fixo) return cell.cor_fixo
  const n = parseFloat(String(raw ?? '').replace(',', '.'))
  if (isNaN(n)) return null
  if (n > 0 && cell.cor_pos) return cell.cor_pos
  if (n < 0 && cell.cor_neg) return cell.cor_neg
  if (n === 0 && cell.cor_zero) return cell.cor_zero
  return null
}

export default function DetailPanel({ data, config, expanded = false }) {
  const { theme, layoutPrefs } = useRaioX()
  const dark = theme === 'dark'
  const scale = layoutPrefs?.scale || 1

  const rows = config?.rows || 1
  const cols = config?.cols || 1
  const cells = config?.cells || {}

  const hasAnyCells = Object.values(cells).some(c => c && (c.coluna || c.valor))

  if (!data?.length || !hasAnyCells) {
    return (
      <div className={`flex-1 flex items-center justify-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
        {!data?.length ? 'Sem dados.' : 'Nenhuma célula configurada. Configure em ⚙ Config → Painel de Detalhe.'}
      </div>
    )
  }

  const row = data[config?.fonte_row ?? 0] ?? data[0]

  const effectiveCols = expanded ? Math.max(1, Math.min(cols, layoutPrefs?.detailMaxColsFullscreen || 4)) : cols
  const gap = Math.round((expanded ? 10 : 6) * scale)
  const pad = Math.round((expanded ? 16 : 12) * scale)
  const minCellHeight = Math.round((expanded ? 88 : 60) * scale)

  return (
    <div
      className="h-full overflow-auto"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`, gap: `${gap}px`, alignContent: 'start', padding: `${pad}px` }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const key = `${r},${c}`
          const cell = cells[key]
          if (!cell) return <div key={key} />
          if (cell.tipo === 'texto') {
            return (
              <div key={key} className={`rounded ${dark ? 'text-slate-300' : 'text-slate-600'}`} style={{ padding: `${Math.max(10, pad)}px`, fontSize: `${Math.round((expanded ? 14 : 12) * scale)}px`, minHeight: `${minCellHeight}px` }}>
                {cell.valor}
              </div>
            )
          }
          const raw = row[cell.coluna]
          const display = formatValue(raw, cell.formato || 'auto', {
            decimals: cell.casas_decimais,
            prefix: cell.prefix || '',
            suffix: cell.suffix || '',
          })
          const color = getColor(raw, cell)
          const textAlign = cell.alinhamento || 'left'
          const justifyContent = cell.alinhamento_vertical === 'bottom'
            ? 'flex-end'
            : cell.alinhamento_vertical === 'middle'
              ? 'center'
              : 'flex-start'
          const labelSize = resolveFontSize(cell.label_tamanho_fonte || 'xs', cell.label_tamanho_fonte_px, expanded)
          const valueSize = resolveFontSize(cell.valor_tamanho_fonte || 'xl', cell.valor_tamanho_fonte_px, expanded)
          return (
            <div
              key={key}
              className={`rounded flex flex-col ${dark ? 'bg-slate-800/50' : 'bg-slate-100/80'}`}
              style={{ justifyContent, textAlign, padding: `${Math.max(10, pad)}px`, minHeight: `${minCellHeight}px` }}
            >
              {cell.label && (
                <div className={`${expanded ? 'mb-1' : 'mb-0.5'} ${dark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: `${labelSize}px` }}>{cell.label}</div>
              )}
              <div className="font-semibold break-words" style={{ color: color ?? (dark ? '#e2e8f0' : '#0f172a'), fontSize: `${valueSize}px` }}>
                {display}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
