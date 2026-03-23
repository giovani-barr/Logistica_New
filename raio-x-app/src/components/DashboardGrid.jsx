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

// Agrupa itens consecutivos do tipo 'campo' numa mesma linha
function groupComponents(ordem) {
  const groups = []
  let campoGroup = []
  for (const id of ordem) {
    const { base } = parseCompId(id)
    if (base === 'campo') {
      campoGroup.push(id)
    } else {
      if (campoGroup.length) { groups.push({ type: 'campo-row', ids: campoGroup }); campoGroup = [] }
      groups.push({ type: 'single', id })
    }
  }
  if (campoGroup.length) groups.push({ type: 'campo-row', ids: campoGroup })
  return groups
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

  const groups = groupComponents(visibleComponents)

  return (
    <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: `${widgetPadding}px`, gap: `${gridGap}px` }}>
      {groups.map((group, gi) => {
        if (group.type === 'campo-row') {
          // Linha de widgets de campo — flex row, altura fixa
          return (
            <div key={`row-${gi}`} className="flex flex-wrap" style={{ gap: `${gridGap}px` }}>
              {group.ids.map(id => {
                const { widgetId } = parseCompId(id)
                const config = (aba.widget_configs || {})[widgetId] || {}
                return (
                  <div key={id} className="flex-1" style={{ minWidth: `${layoutPrefs?.fieldMinWidth || 160}px` }}>
                    <FieldWidget
                      widgetId={widgetId}
                      config={config}
                      data={data}
                      columns={columns}
                      onUpdate={handleUpdateWidget}
                    />
                  </div>
                )
              })}
            </div>
          )
        }
        // Widget normal
        const { id } = group
        const { base, sub } = parseCompId(id)
        const heightKey = base === 'sql_extra' ? `sql_${sub}` : base
        const expanded = isFullscreen || fullscreenWidget === id
        return (
          <WidgetCard key={id} id={id} height={getWidgetHeight(heightKey || base)}>
            {renderWidget(id, expanded)}
          </WidgetCard>
        )
      })}
      {groups.length === 0 && (
        <div className={`flex-1 flex items-center justify-center text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          Nenhum componente visível. Configure em ⚙ Config.
        </div>
      )}
    </div>
  )
}

