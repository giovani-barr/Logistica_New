// ChartWidget.jsx — Apache ECharts com múltiplas séries, formatação avançada e painel inline
import { useState, useMemo, useEffect, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import { Settings, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useRaioX } from '../../context/RaioXContext'

// ── Paleta padrão ────────────────────────────────────────────────────────────
const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#6366f1', '#84cc16',
]

const CHART_TYPES = [
  { value: 'bar',     label: 'Barras' },
  { value: 'bar_h',   label: 'Barras Horizontais' },
  { value: 'line',    label: 'Linha' },
  { value: 'area',    label: 'Área' },
  { value: 'pie',     label: 'Pizza' },
  { value: 'scatter', label: 'Dispersão' },
  { value: 'radar',   label: 'Radar' },
  { value: 'mixed',   label: 'Misto (Barra+Linha)' },
]

const SERIE_TYPES = [
  { value: 'bar',  label: 'Barra' },
  { value: 'line', label: 'Linha' },
  { value: 'area', label: 'Área' },
]

const VALUE_FORMATS = [
  { value: 'auto',     label: 'Auto' },
  { value: 'compact',  label: 'Compacto (1,2k)' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'integer',  label: 'Inteiro' },
  { value: 'percent',  label: 'Percentual (%)' },
  { value: 'decimal2', label: 'Decimal 2 casas' },
]

// ── Formatador de valores ─────────────────────────────────────────────────────
function formatValue(val, fmt) {
  const n = parseFloat(val)
  if (isNaN(n)) return String(val ?? '')
  switch (fmt) {
    case 'compact': {
      const abs = Math.abs(n)
      if (abs >= 1_000_000) return (n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M'
      if (abs >= 1_000)     return (n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'
      return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    }
    case 'currency':
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    case 'integer':
      return Math.round(n).toLocaleString('pt-BR')
    case 'percent':
      return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
    case 'decimal2':
      return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    default: // auto
      return n % 1 === 0
        ? n.toLocaleString('pt-BR')
        : n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }
}

// ── Migração backward-compat: antigo value_col → series[] ────────────────────
function normalizeGraficoConfig(cfg, cols) {
  if (!cfg) cfg = {}
  let series = cfg.series && cfg.series.length > 0
    ? cfg.series
    : cfg.value_col
      ? [{ col: cfg.value_col, label: cfg.value_col, color: DEFAULT_COLORS[0], type: 'bar' }]
      : (cols && cols.length >= 2
          ? [{ col: cols[1], label: cols[1], color: DEFAULT_COLORS[0], type: 'bar' }]
          : [])
  return {
    tipo: 'bar',
    label_col: (cols && cols[0]) || '',
    series,
    format: 'auto',
    stacked: false,
    show_legend: true,
    show_data_labels: false,
    visivel: true,
    ...cfg,
    series,
  }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChartWidget({ data, config, onConfigChange }) {
  const { theme } = useRaioX()
  const dark = theme === 'dark'

  const cols = useMemo(() => (data?.length ? Object.keys(data[0]) : []), [data])
  const [localCfg, setLocalCfg] = useState(() => normalizeGraficoConfig(config, cols))
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setLocalCfg(normalizeGraficoConfig(config, cols))
  }, [config, cols]) // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback((patch) => {
    const next = { ...localCfg, ...patch }
    setLocalCfg(next)
    onConfigChange?.(next)
  }, [localCfg, onConfigChange])

  // ── Construção do option ECharts ──────────────────────────────────────────
  const { tipo, label_col, series, format, stacked, show_legend, show_data_labels } = localCfg
  const fmt = format || 'auto'

  const xData = useMemo(() =>
    (data || []).map(r => r[label_col] != null ? String(r[label_col]) : ''),
  [data, label_col])

  const echartsOption = useMemo(() => {
    if (!data?.length) return {}
    const textClr  = dark ? '#94a3b8' : '#64748b'
    const gridClr  = dark ? '#334155' : '#e2e8f0'

    const labelFormatter = (params) => {
      const arr = Array.isArray(params) ? params : [params]
      return arr.map(p => `${p.seriesName}: <b>${formatValue(p.value, fmt)}</b>`).join('<br/>')
    }
    const axisFormatter = (v) => formatValue(v, fmt)

    // ── Pizza ──────────────────────────────────────────────────────────────
    if (tipo === 'pie') {
      const firstSerie = (series && series[0]) || { col: cols[1], label: cols[1] || 'Valor' }
      if (!firstSerie?.col) return {}
      return {
        tooltip: { trigger: 'item', formatter: (p) => `${p.name}: <b>${formatValue(p.value, fmt)}</b> (${p.percent}%)` },
        legend: show_legend ? { type: 'scroll', bottom: 0, textStyle: { color: textClr, fontSize: 11 } } : { show: false },
        series: [{
          type: 'pie', radius: ['35%', '70%'], avoidLabelOverlap: true,
          label: { show: show_data_labels, formatter: (p) => `${p.name}\n${formatValue(p.value, fmt)}`, fontSize: 11 },
          emphasis: { label: { show: true, fontWeight: 'bold' } },
          data: (data || []).map((r, i) => ({
            name: r[label_col] != null ? String(r[label_col]) : String(i),
            value: parseFloat(r[firstSerie.col]) || 0,
            itemStyle: { color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] },
          })),
        }],
      }
    }

    // ── Radar ──────────────────────────────────────────────────────────────
    if (tipo === 'radar') {
      if (!series?.length || !label_col) return {}
      return {
        tooltip: { trigger: 'item' },
        legend: show_legend ? { bottom: 0, textStyle: { color: textClr, fontSize: 11 } } : { show: false },
        radar: {
          indicator: (data || []).map(r => ({ name: String(r[label_col] ?? ''), max: undefined })),
          axisName: { color: textClr, fontSize: 10 },
          splitLine: { lineStyle: { color: gridClr } },
          splitArea: { show: false },
        },
        series: [{ type: 'radar', data: series.map((s, si) => ({
          name: s.label || s.col,
          areaStyle: { opacity: 0.2 },
          lineStyle: { color: s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length] },
          itemStyle: { color: s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length] },
          value: (data || []).map(r => parseFloat(r[s.col]) || 0),
        })) }],
      }
    }

    // ── Dispersão ──────────────────────────────────────────────────────────
    if (tipo === 'scatter') {
      if (!series?.length || !label_col) return {}
      return {
        tooltip: { formatter: (p) => `${p.data[0]}: ${formatValue(p.data[1], fmt)}` },
        grid: { left: 16, right: 16, top: 20, bottom: 60, containLabel: true },
        xAxis: { type: 'category', data: xData, axisLabel: { color: textClr, fontSize: 10, rotate: -30 }, splitLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { color: textClr, fontSize: 10, formatter: axisFormatter }, splitLine: { lineStyle: { color: gridClr } }, minInterval: 0 },
        series: series.map((s, si) => ({
          type: 'scatter', name: s.label || s.col, symbolSize: 8,
          itemStyle: { color: s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length] },
          data: (data || []).map(r => [r[label_col] != null ? String(r[label_col]) : '', parseFloat(r[s.col]) || 0]),
        })),
      }
    }

    // ── Barras horizontais ─────────────────────────────────────────────────
    if (tipo === 'bar_h') {
      if (!label_col || !series?.length) return {}
      return {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: labelFormatter },
        grid: { left: 140, right: 60, top: 20, bottom: 30, containLabel: false },
        legend: show_legend ? { bottom: 0, textStyle: { color: textClr, fontSize: 11 } } : { show: false },
        yAxis: { type: 'category', data: xData, axisLabel: { color: textClr, fontSize: 10 }, inverse: true },
        xAxis: { type: 'value', axisLabel: { color: textClr, fontSize: 10, formatter: axisFormatter }, splitLine: { lineStyle: { color: gridClr } }, minInterval: 0 },
        dataZoom: data.length > 20 ? [{ type: 'slider', orient: 'vertical', width: 18, right: 10, startValue: 0, endValue: 19 }] : [],
        toolbox: { show: true, orient: 'vertical', right: 4, top: 20, feature: { saveAsImage: { title: 'Salvar', pixelRatio: 2 } } },
        series: series.map((s, si) => ({
          type: 'bar', name: s.label || s.col, barMaxWidth: 32,
          itemStyle: { color: s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length], borderRadius: [0, 4, 4, 0] },
          stack: stacked ? 'total' : undefined,
          label: show_data_labels ? { show: true, position: 'right', formatter: (p) => formatValue(p.value, fmt), fontSize: 10, color: textClr } : { show: false },
          data: (data || []).map(r => parseFloat(r[s.col]) || 0),
        })),
      }
    }

    // ── Bar / Line / Area / Mixed ──────────────────────────────────────────
    if (!label_col || !series?.length) return {}
    const eSeriesArr = series.map((s, si) => {
      const sType = tipo === 'line' ? 'line'
        : tipo === 'area' ? 'line'
        : tipo === 'mixed' ? (s.type === 'line' || s.type === 'area' ? 'line' : 'bar')
        : 'bar'
      const clr = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length]
      return {
        type: sType, name: s.label || s.col, smooth: sType === 'line',
        barMaxWidth: 48,
        itemStyle: { color: clr, borderRadius: sType === 'bar' ? [4, 4, 0, 0] : 0 },
        lineStyle: sType === 'line' ? { color: clr, width: 2 } : undefined,
        areaStyle: (tipo === 'area' || s.type === 'area') ? { color: clr + '33' } : undefined,
        symbol: sType === 'line' ? 'circle' : undefined, symbolSize: 6,
        stack: stacked && tipo !== 'mixed' ? 'total' : undefined,
        label: show_data_labels ? {
          show: true, position: sType === 'bar' ? 'top' : 'inside',
          formatter: (p) => formatValue(p.value, fmt), fontSize: 10, color: textClr,
        } : { show: false },
        data: (data || []).map(r => parseFloat(r[s.col]) || 0),
      }
    })

    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: labelFormatter,
        backgroundColor: dark ? '#1e293b' : '#fff',
        borderColor: dark ? '#334155' : '#e2e8f0',
        textStyle: { color: dark ? '#e2e8f0' : '#1e293b', fontSize: 12 },
      },
      legend: show_legend ? { type: 'scroll', bottom: data.length > 20 ? 30 : 0, textStyle: { color: textClr, fontSize: 11 } } : { show: false },
      grid: { left: 16, right: 16, top: 20, bottom: data.length > 20 ? 70 : 50, containLabel: true },
      xAxis: {
        type: 'category', data: xData,
        axisLabel: { color: textClr, fontSize: 10, rotate: xData.length > 12 ? -35 : 0, interval: 0 },
        splitLine: { show: false }, axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: textClr, fontSize: 10, formatter: axisFormatter },
        splitLine: { lineStyle: { color: gridClr } }, minInterval: 0,
      },
      dataZoom: data.length > 20 ? [
        { type: 'slider', height: 18, bottom: show_legend ? 22 : 4, startValue: 0, endValue: 19, borderColor: 'transparent' },
        { type: 'inside' },
      ] : [],
      toolbox: { show: true, orient: 'vertical', right: 0, top: 0, feature: { saveAsImage: { title: 'Salvar', pixelRatio: 2 } } },
      series: eSeriesArr,
    }
  }, [data, tipo, label_col, series, fmt, stacked, show_legend, show_data_labels, dark, cols, xData])

  // ── Helpers do painel ─────────────────────────────────────────────────────
  const updateSerie = (idx, patch) => {
    const next = [...(localCfg.series || [])]
    next[idx] = { ...next[idx], ...patch }
    emit({ series: next })
  }
  const addSerie = () => {
    const used = new Set((localCfg.series || []).map(s => s.col))
    const nextCol = cols.find(c => c !== localCfg.label_col && !used.has(c)) || ''
    const idx = (localCfg.series || []).length
    emit({ series: [...(localCfg.series || []), { col: nextCol, label: nextCol, color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length], type: 'bar' }] })
  }
  const removeSerie = (idx) => emit({ series: (localCfg.series || []).filter((_, i) => i !== idx) })

  // ── Estilos ───────────────────────────────────────────────────────────────
  const panelCls = dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  const rowCls   = dark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
  const textMuted = dark ? 'text-slate-400' : 'text-slate-500'
  const textMain  = dark ? 'text-slate-200' : 'text-slate-800'
  const selectCls = `w-full rounded border px-2 py-1 text-xs outline-none ${dark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'}`
  const inputCls  = `w-full rounded border px-2 py-1 text-xs outline-none ${dark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'}`
  const labelCls  = `block text-[10px] font-medium mb-0.5 ${textMuted}`
  const btnSm     = `inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors`
  const isEmpty   = !data?.length || !localCfg.label_col || !(localCfg.series?.some(s => s.col))

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>

      {/* Barra de ferramentas */}
      <div className="flex items-center justify-between mb-1 px-0.5 shrink-0">
        <span className={`text-[10px] ${textMuted} truncate`}>
          {localCfg.series?.length ? `${localCfg.series.length} série(s)` : 'Nenhuma série'}
          {localCfg.label_col ? ` · ${localCfg.label_col}` : ''}
        </span>
        <button
          onClick={() => setShowSettings(v => !v)}
          className={`${btnSm} flex-shrink-0 ${dark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
        >
          <Settings size={11} />
          Configurar
          {showSettings ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {/* Painel de configuração inline */}
      {showSettings && (
        <div className={`shrink-0 rounded-lg border p-3 mb-2 space-y-3 overflow-y-auto ${panelCls}`} style={{ maxHeight: 360 }}>

          {/* Tipo + Eixo X */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo de gráfico</label>
              <select value={localCfg.tipo || 'bar'} onChange={e => emit({ tipo: e.target.value })} className={selectCls}>
                {CHART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Eixo X (categorias)</label>
              <select value={localCfg.label_col || ''} onChange={e => emit({ label_col: e.target.value })} className={selectCls}>
                <option value="">— Selecione —</option>
                {cols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Séries */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>Séries / Valores</span>
              <button onClick={addSerie} className={`${btnSm} ${dark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                <Plus size={10} /> Adicionar
              </button>
            </div>
            {!(localCfg.series?.length) && (
              <p className={`text-[11px] ${textMuted}`}>Clique em "+ Adicionar" para incluir uma coluna.</p>
            )}
            <div className="space-y-2">
              {(localCfg.series || []).map((s, idx) => (
                <div key={idx} className={`rounded border p-2 space-y-1.5 ${rowCls}`}>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className={labelCls}>Coluna</label>
                      <select value={s.col || ''} onChange={e => updateSerie(idx, { col: e.target.value, label: s.label || e.target.value })} className={selectCls}>
                        <option value="">— Selecione —</option>
                        {cols.filter(c => c !== localCfg.label_col).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Rótulo</label>
                      <input value={s.label || ''} onChange={e => updateSerie(idx, { label: e.target.value })} placeholder={s.col || 'Série'} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 items-end">
                    <div>
                      <label className={labelCls}>Tipo{localCfg.tipo !== 'mixed' ? ' (só no modo Misto)' : ''}</label>
                      <select value={s.type || 'bar'} onChange={e => updateSerie(idx, { type: e.target.value })} className={selectCls} disabled={localCfg.tipo !== 'mixed'}>
                        {SERIE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Cor</label>
                      <div className="flex gap-1 items-center">
                        <input type="color" value={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                          onChange={e => updateSerie(idx, { color: e.target.value })}
                          className="w-8 h-7 rounded cursor-pointer border-0 p-0.5"
                          style={{ background: 'transparent' }}
                        />
                        <input value={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                          onChange={e => updateSerie(idx, { color: e.target.value })}
                          className={`${inputCls} font-mono`} style={{ width: 70 }}
                        />
                      </div>
                    </div>
                    <button onClick={() => removeSerie(idx)} className={`p-1.5 rounded self-end ${dark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}`} title="Remover série">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formato dos valores */}
          <div>
            <label className={labelCls}>Formato dos valores</label>
            <div className="flex flex-wrap gap-1.5">
              {VALUE_FORMATS.map(f => (
                <button key={f.value} type="button" onClick={() => emit({ format: f.value })}
                  className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                    (localCfg.format || 'auto') === f.value
                      ? (dark ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-700')
                      : (dark ? 'border-slate-700 text-slate-400 hover:border-slate-500' : 'border-slate-200 text-slate-600 hover:border-slate-400')
                  }`}
                >{f.label}</button>
              ))}
            </div>
            <p className={`mt-1 text-[10px] ${textMuted}`}>Exemplo: {formatValue(1234567.89, localCfg.format || 'auto')}</p>
          </div>

          {/* Opções */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { key: 'stacked',          label: 'Empilhado' },
              { key: 'show_legend',      label: 'Mostrar legenda' },
              { key: 'show_data_labels', label: 'Rótulos nas barras' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={!!localCfg[key]} onChange={e => emit({ [key]: e.target.checked })}
                  className="w-3.5 h-3.5 rounded accent-blue-500" />
                <span className={`text-xs ${textMain}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Área do gráfico */}
      <div className="flex-1" style={{ minHeight: 0 }}>
        {!isEmpty ? (
          <ReactECharts
            option={echartsOption}
            style={{ width: '100%', height: '100%' }}
            notMerge
            lazyUpdate
          />
        ) : (
          <div className={`flex flex-col items-center justify-center h-full gap-2 ${textMuted}`}>
            <Settings size={28} className="opacity-20" />
            <span className="text-sm">Clique em <b>Configurar</b> para montar o gráfico</span>
          </div>
        )}
      </div>
    </div>
  )
}
