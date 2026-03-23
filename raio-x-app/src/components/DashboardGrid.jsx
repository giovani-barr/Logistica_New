import { useCallback, useMemo } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import KpiCards from './widgets/KpiCards'
import DataTable from './widgets/DataTable'
import ChartWidget from './widgets/ChartWidget'
import PivotTable from './widgets/PivotTable'
import FieldWidget from './widgets/FieldWidget'
import DetailPanel from './widgets/DetailPanel'
import { useRaioX } from '../context/RaioXContext'
import { exportToExcel } from '../utils/exportExcel'

// Alturas padrão por componente (em pixels)
const DEFAULT_HEIGHTS = { kpis: 140, tabela: 420, grafico: 320, pivot: 420, campo: 120, sql_tabela: 420, sql_grafico: 320, sql_pivot: 420, detalhe: 300 }

const WIDGET_TITLES = {
  kpis: 'Indicadores',
  tabela: 'Dados',
  grafico: 'Gráfico',
  pivot: 'Tabela Pivot',
  detalhe: 'Painel de Detalhe',
}

// Tipos que suportam múltiplas instâncias nomeadas (tipo:instanceId)
const SQL_INSTANCE_TYPES = ['kpis', 'tabela', 'grafico', 'pivot', 'detalhe']

// Extrai tipo base e params de um id de componente
function parseCompId(id) {
  if (!id) return { base: id }
  if (id.startsWith('campo:')) return { base: 'campo', widgetId: id.slice(6) }
  if (id.startsWith('sql_extra:')) {
    const parts = id.split(':')  // sql_extra:<idLocal>:<sub>
    return { base: 'sql_extra', idLocal: parts[1], sub: parts[2] || 'tabela' }
  }
  // Named instance: tipo:instanceId
  for (const tipo of SQL_INSTANCE_TYPES) {
    if (id.startsWith(tipo + ':')) return { base: tipo, instanceId: id.slice(tipo.length + 1) }
  }
  return { base: id }
}

const GRID_COLUMNS = 8

const WIDTH_BY_LEGACY_NAME = {
  full: 100,
  two_thirds: 66.67,
  half: 50,
  one_third: 33.33,
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getLayoutEntry(layoutConfig, componentId) {
  const raw = layoutConfig?.[componentId] || {}
  let widthPct

  if (Number.isFinite(Number(raw.widthPct))) {
    widthPct = Number(raw.widthPct)
  } else if (Number.isFinite(Number(raw.widthSteps))) {
    widthPct = Number(raw.widthSteps) * 12.5
  } else if (raw.width && Number.isFinite(Number(raw.width))) {
    widthPct = Number(raw.width)
  } else if (raw.width && Object.prototype.hasOwnProperty.call(WIDTH_BY_LEGACY_NAME, raw.width)) {
    widthPct = WIDTH_BY_LEGACY_NAME[raw.width]
  } else {
    widthPct = 100
  }

  const heightDeltaPct = Number.isFinite(Number(raw.heightDeltaPct))
    ? clampNumber(Math.round(Number(raw.heightDeltaPct) / 10) * 10, -50, 50)
    : 0

  return {
    widthPct: clampNumber(widthPct, 12.5, 100),
    heightDeltaPct,
  }
}

// Agrupa componentes por linhas com base na largura configurada (grade de 12 colunas)
function buildLayoutRows(ordem, layoutConfig) {
  const rows = []
  let current = []
  let used = 0

  for (const id of ordem) {
    const layout = getLayoutEntry(layoutConfig, id)
    const span = clampNumber(Math.round(layout.widthPct / 12.5), 1, GRID_COLUMNS)

    if (used + span > GRID_COLUMNS && current.length) {
      rows.push(current)
      current = []
      used = 0
    }

    current.push({ id, span, layout })
    used += span

    if (used >= GRID_COLUMNS) {
      rows.push(current)
      current = []
      used = 0
    }
  }

  if (current.length) rows.push(current)
  return rows
}

export default function DashboardGrid({ aba, data, extraCache = {} }) {
  const { theme, fullscreenWidget, setFullscreenWidget, updateAbaInline, isFullscreen, layoutPrefs } = useRaioX()
  const dark = theme === 'dark'
  const scale = layoutPrefs?.scale || 1
  const gridGap = Math.round((layoutPrefs?.widgetGap || 8) * scale)
  const widgetPadding = Math.round((layoutPrefs?.widgetPadding || 8) * scale)

  const getWidgetHeight = useCallback((key) => {
    if (!key) return 320
    const baseKey = key.startsWith('sql_') ? key.slice(4) : key
    const configured = layoutPrefs?.widgetHeights?.[baseKey]
    if (Number.isFinite(Number(configured))) return Number(configured)
    return DEFAULT_HEIGHTS[key] ?? DEFAULT_HEIGHTS[baseKey] ?? 320
  }, [layoutPrefs])

  const getEffectiveWidgetHeight = useCallback((heightKey, componentId) => {
    const baseHeight = getWidgetHeight(heightKey)
    const layout = getLayoutEntry(aba.layout_config || {}, componentId)
    const adjusted = Math.round(baseHeight * (1 + (layout.heightDeltaPct / 100)))
    return clampNumber(adjusted, 80, 1200)
  }, [getWidgetHeight, aba.layout_config])

  // Colunas disponíveis do SQL principal
  const columns = useMemo(() => {
    if (!data?.length) return []
    return Object.keys(data[0] || {})
  }, [data])

  const visibleComponents = useMemo(() => {
    const ordem = aba.componentes_ordem || []
    let result
    if (ordem.length) {
      result = ordem
    } else {
      // Fallback: componentes legados
      const items = []
      if (aba.kpis_config?.length) items.push('kpis')
      items.push('tabela')
      if (aba.grafico_config?.visivel !== false) items.push('grafico')
      result = items
    }
    // Auto-inclui detalhe quando células estão configuradas mas não está na ordem
    // (compatibilidade com abas criadas antes de 'detalhe' ser adicionado ao SQL_COMPONENTS)
    const hasDetailCells = Object.values(aba.detail_config?.cells || {}).some(c => c && (c.coluna || c.valor))
    if (hasDetailCells && !result.includes('detalhe')) {
      result = [...result, 'detalhe']
    }
    return result
  }, [aba])

  const handleExport = useCallback((rows) => {
    exportToExcel(rows, aba.nome || 'dados')
  }, [aba.nome])

  // Atualiza widget_configs inline (persiste no backend)
  const handleUpdateWidget = useCallback((widgetId, config) => {
    const next = { ...(aba.widget_configs || {}), [widgetId]: config }
    updateAbaInline(aba.id, { widget_configs: next })
  }, [aba.id, aba.widget_configs, updateAbaInline])

  // Persiste configuração do gráfico principal ao mudar seletores ao vivo
  const handleUpdateMainChart = useCallback((cfg) => {
    updateAbaInline(aba.id, { grafico_config: { ...(aba.grafico_config || {}), ...cfg } })
  }, [aba.id, aba.grafico_config, updateAbaInline])

  // Persiste configuração do gráfico de instância nomeada ao mudar seletores ao vivo
  const handleUpdateInstanceChart = useCallback((instanceId, cfg) => {
    const wc = { ...(aba.widget_configs || {}) }
    wc[instanceId] = { ...(wc[instanceId] || {}), grafico_config: { ...((wc[instanceId] || {}).grafico_config || {}), ...cfg } }
    updateAbaInline(aba.id, { widget_configs: wc })
  }, [aba.id, aba.widget_configs, updateAbaInline])

  // Persiste configuração do gráfico de SQL extra ao mudar seletores ao vivo
  const handleUpdateExtraChart = useCallback((idLocal, cfg) => {
    const nextExtras = (aba.sqls_extras || []).map(e =>
      e.id_local === idLocal
        ? { ...e, grafico_config: { ...(e.grafico_config || {}), ...cfg } }
        : e
    )
    updateAbaInline(aba.id, { sqls_extras: nextExtras })
  }, [aba.id, aba.sqls_extras, updateAbaInline])

  const cardCls = `rounded-xl border flex flex-col overflow-hidden ${
    dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
  }`

  const getTitle = (id) => {
    if (WIDGET_TITLES[id]) return WIDGET_TITLES[id]
    const { base, instanceId, idLocal, sub } = parseCompId(id)
    // Named instance — numera se houver mais de uma do mesmo tipo visível
    if (instanceId && WIDGET_TITLES[base]) {
      const allOfType = visibleComponents.filter(c => parseCompId(c).base === base)
      if (allOfType.length > 1) {
        const idx = allOfType.indexOf(id)
        return `${WIDGET_TITLES[base]} ${idx + 1}`
      }
      return WIDGET_TITLES[base]
    }
    if (base === 'sql_extra') {
      const extra = (aba.sqls_extras || []).find(e => e.id_local === idLocal)
      const subLabel = sub === 'tabela' ? 'Dados' : sub === 'grafico' ? 'Gráfico' : 'Pivot'
      return extra?.titulo ? `${extra.titulo} — ${subLabel}` : subLabel
    }
    return id
  }

  const WidgetCard = ({ id, children, height }) => {
    const isFs = fullscreenWidget === id
    return (
      <div className={cardCls} style={{ height: height ?? getWidgetHeight(id) }}>
        <div className={`flex items-center justify-between border-b shrink-0 ${dark ? 'border-slate-700' : 'border-slate-100'}`} style={{ paddingLeft: Math.max(10, widgetPadding + 4), paddingRight: Math.max(10, widgetPadding + 4), paddingTop: Math.max(6, Math.round(widgetPadding * 0.65)), paddingBottom: Math.max(6, Math.round(widgetPadding * 0.65)) }}>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{getTitle(id)}</span>
          <button
            onClick={() => setFullscreenWidget(isFs ? null : id)}
            className={`p-1 rounded ${dark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            title={isFs ? 'Restaurar' : 'Expandir'}
          >
            {isFs ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
        <div className="flex-1 overflow-auto" style={{ minHeight: 0, padding: `${widgetPadding}px` }}>
          {children}
        </div>
      </div>
    )
  }

  const renderWidget = (id, expanded = false) => {
    const { base, widgetId, idLocal, sub, instanceId } = parseCompId(id)

    // Named instance (tipo:instanceId) — lê config de widget_configs[instanceId]
    if (instanceId) {
      const ic = (aba.widget_configs || {})[instanceId] || {}
      if (base === 'kpis')    return <KpiCards data={data} config={ic.kpis_config || []} abaId={`${aba.id}-${instanceId}`} expanded={expanded} />
      if (base === 'tabela')  return <DataTable data={data} colunasVisiveis={ic.colunas_visiveis || []} abaId={`${aba.id}-${instanceId}`} onExport={(rows) => exportToExcel(rows, aba.nome || 'dados')} expanded={expanded} />
      if (base === 'grafico') return <ChartWidget data={data} config={ic.grafico_config || {}} abaId={`${aba.id}-${instanceId}`} onConfigChange={(cfg) => handleUpdateInstanceChart(instanceId, cfg)} expanded={expanded} />
      if (base === 'pivot')   return <PivotTable data={data} config={ic.pivot_config || {}} abaId={`${aba.id}-${instanceId}`} expanded={expanded} />
      if (base === 'detalhe') return <DetailPanel data={data} config={ic.detail_config || {}} expanded={expanded} />
    }

    // Componentes legados fixos (bare names)
    if (base === 'kpis')   return <KpiCards data={data} config={aba.kpis_config} abaId={aba.id} expanded={expanded} />
    if (base === 'tabela') return <DataTable data={data} colunasVisiveis={aba.colunas_visiveis} abaId={aba.id} onExport={handleExport} expanded={expanded} />
    if (base === 'grafico')return <ChartWidget data={data} config={aba.grafico_config} abaId={aba.id} onConfigChange={handleUpdateMainChart} expanded={expanded} />
    if (base === 'pivot')  return <PivotTable data={data} config={aba.pivot_config} abaId={aba.id} expanded={expanded} />
    if (base === 'detalhe') return <DetailPanel data={data} config={aba.detail_config} expanded={expanded} />

    // Widget de campo (FieldWidget)
    if (base === 'campo') {
      const config = (aba.widget_configs || {})[widgetId] || {}
      return (
        <FieldWidget
          widgetId={widgetId}
          config={config}
          data={data}
          columns={columns}
          onUpdate={handleUpdateWidget}
          expanded={expanded}
        />
      )
    }

    // SQL extra
    if (base === 'sql_extra') {
      const cacheKey = `${aba.id}::${idLocal}`
      const cached = extraCache[cacheKey] || {}
      const extraData = cached.data || []
      const extra = (aba.sqls_extras || []).find(e => e.id_local === idLocal) || {}
      if (cached.error) return <div className="text-red-500 text-xs p-2">❌ {cached.error}</div>
      if (!cached.data) return <div className="text-slate-400 text-xs p-2 flex items-center gap-2"><span className="animate-spin">⟳</span> Carregando...</div>

      if (sub === 'tabela') return <DataTable data={extraData} colunasVisiveis={extra.colunas_visiveis || []} abaId={`${aba.id}-${idLocal}`} onExport={(rows) => exportToExcel(rows, extra.titulo || 'dados')} expanded={expanded} />
      if (sub === 'grafico') return <ChartWidget data={extraData} config={extra.grafico_config || {}} abaId={`${aba.id}-${idLocal}`} onConfigChange={(cfg) => handleUpdateExtraChart(idLocal, cfg)} expanded={expanded} />
      if (sub === 'pivot') return <PivotTable data={extraData} config={extra.pivot_config || {}} abaId={`${aba.id}-${idLocal}`} expanded={expanded} />
      if (sub === 'detalhe') return <DetailPanel data={extraData} config={extra.detail_config || {}} expanded={expanded} />
    }

    return null
  }

  // Modo tela cheia
  if (fullscreenWidget) {
    const id = fullscreenWidget
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ padding: `${widgetPadding}px` }}>
        <div className={`${cardCls} flex-1`} style={{ height: undefined }}>
          <div className={`flex items-center justify-between border-b shrink-0 ${dark ? 'border-slate-700' : 'border-slate-100'}`} style={{ paddingLeft: Math.max(10, widgetPadding + 4), paddingRight: Math.max(10, widgetPadding + 4), paddingTop: Math.max(6, Math.round(widgetPadding * 0.65)), paddingBottom: Math.max(6, Math.round(widgetPadding * 0.65)) }}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{getTitle(id)}</span>
            <button onClick={() => setFullscreenWidget(null)} className={`p-1 rounded ${dark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`} title="Restaurar">
              <Minimize2 size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-auto" style={{ minHeight: 0, padding: `${widgetPadding}px` }}>
            {renderWidget(id, true)}
          </div>
        </div>
      </div>
    )
  }

  const rows = useMemo(
    () => buildLayoutRows(visibleComponents, aba.layout_config || {}),
    [visibleComponents, aba.layout_config]
  )

  const getDesktopSpanClass = (span) => {
    if (span >= 8) return 'lg:col-span-8'
    if (span === 7) return 'lg:col-span-7'
    if (span === 6) return 'lg:col-span-6'
    if (span === 5) return 'lg:col-span-5'
    if (span === 4) return 'lg:col-span-4'
    if (span === 3) return 'lg:col-span-3'
    if (span === 2) return 'lg:col-span-2'
    if (span === 1) return 'lg:col-span-1'
    return 'lg:col-span-8'
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: `${widgetPadding}px`, gap: `${gridGap}px` }}>
      {rows.map((row, rowIdx) => (
        <div key={`row-${rowIdx}`} className="grid grid-cols-1 lg:grid-cols-8" style={{ gap: `${gridGap}px` }}>
          {row.map((item) => {
            const { id, span } = item
            const { base, sub } = parseCompId(id)
            const expanded = isFullscreen || fullscreenWidget === id
            const spanClass = getDesktopSpanClass(span)

            if (base === 'campo') {
              const { widgetId } = parseCompId(id)
              const config = (aba.widget_configs || {})[widgetId] || {}
              return (
                <div key={id} className={`min-w-0 ${spanClass}`} style={{ height: getEffectiveWidgetHeight('campo', id) }}>
                  <FieldWidget
                    widgetId={widgetId}
                    config={config}
                    data={data}
                    columns={columns}
                    onUpdate={handleUpdateWidget}
                    expanded={expanded}
                  />
                </div>
              )
            }

            const heightKey = base === 'sql_extra' ? `sql_${sub}` : base
            return (
              <div key={id} className={`min-w-0 ${spanClass}`}>
                <WidgetCard id={id} height={getEffectiveWidgetHeight(heightKey || base, id)}>
                  {renderWidget(id, expanded)}
                </WidgetCard>
              </div>
            )
          })}
        </div>
      ))}
      {rows.length === 0 && (
        <div className={`flex-1 flex items-center justify-center text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          Nenhum componente visível. Configure em ⚙ Config.
        </div>
      )}
    </div>
  )
}

