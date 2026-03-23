import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Plus, Minus, Trash2, GripVertical, Save, RotateCcw, ChevronDown, ChevronUp, Database, RefreshCw, Link2 } from 'lucide-react'
import { useRaioX } from '../../context/RaioXContext'
import { FONT_SIZE_PRESETS, TEXT_ALIGN_OPTIONS, VALUE_TYPE_OPTIONS, VERTICAL_ALIGN_OPTIONS } from '../../utils/valueFormatting'

const TIPOS = [
  { value: 'sql', label: 'SQL (Tabela + Gráfico)' },
  { value: 'dados_pedido', label: 'Dados do Pedido' },
  { value: 'texto', label: 'Texto Livre' },
]

const AGREGACOES = [
  { value: 'count',  label: 'Contagem' },
  { value: 'sum',    label: 'Soma' },
  { value: 'avg',    label: 'Média' },
  { value: 'max',    label: 'Máximo' },
  { value: 'min',    label: 'Mínimo' },
  { value: 'first',  label: 'Primeiro valor' },
  { value: 'last',   label: 'Último valor' },
  { value: 'unique', label: 'Cont. únicos' },
  { value: 'concat', label: 'Lista (valores únicos)' },
]

const CHART_TYPES = [
  { value: 'bar',    label: 'Barras' },
  { value: 'bar_h',  label: 'Barras Horizontais' },
  { value: 'line',   label: 'Linha' },
  { value: 'area',   label: 'Área' },
  { value: 'pie',    label: 'Pizza' },
  { value: 'scatter',label: 'Dispersão' },
  { value: 'radar',  label: 'Radar' },
  { value: 'mixed',  label: 'Misto (Barra+Linha)' },
]

const SERIE_TYPES = [
  { value: 'bar',  label: 'Barra' },
  { value: 'line', label: 'Linha' },
  { value: 'area', label: 'Área' },
]

const VALUE_FORMATS = [
  { value: 'auto',     label: 'Auto' },
  { value: 'compact',  label: 'Compacto (1.2k)' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'integer',  label: 'Inteiro' },
  { value: 'percent',  label: 'Percentual (%)' },
  { value: 'decimal2', label: 'Decimal 2 casas' },
]

const DEFAULT_SERIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

const SQL_COMPONENTS = ['kpis', 'tabela', 'grafico', 'pivot', 'detalhe']

const COMPONENT_LABELS = {
  kpis: 'Indicadores',
  tabela: 'Tabela',
  grafico: 'Gráfico',
  pivot: 'Tabela Pivot',
  detalhe: 'Painel de Detalhe',
}

const LAYOUT_WIDTH_OPTIONS = [
  { value: 'full', label: '100% (linha inteira)' },
  { value: 'two_thirds', label: '66% (dois terços)' },
  { value: 'half', label: '50% (meia largura)' },
  { value: 'one_third', label: '33% (um terço)' },
]

const LAYOUT_WIDTH_LABEL = LAYOUT_WIDTH_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

// Mapa tipo → campo legado da aba
const TIPO_FIELDS = {
  kpis: 'kpis_config',
  tabela: 'colunas_visiveis',
  grafico: 'grafico_config',
  pivot: 'pivot_config',
  detalhe: 'detail_config',
}

// Config padrão para nova instância nomeada
function getDefaultInstanceConfig(tipo) {
  if (tipo === 'kpis')    return { kpis_config: [] }
  if (tipo === 'tabela')  return { colunas_visiveis: [] }
  if (tipo === 'grafico') return { grafico_config: { tipo: 'bar', label_col: '', series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, visivel: true } }
  if (tipo === 'pivot')   return { pivot_config: { row_field: '', col_field: '', value_field: '', agregacao: 'count' } }
  if (tipo === 'detalhe') return { detail_config: { fonte_row: 0, rows: 3, cols: 2, cells: {} } }
  return {}
}

function unique(items) {
  return [...new Set((items || []).filter(Boolean))]
}

function reorder(list, fromIndex, toIndex) {
  const copy = [...list]
  const [item] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, item)
  return copy
}

function makeDefaultDetailCell(cell = {}, patch = {}) {
  return {
    tipo: 'campo',
    coluna: '',
    label: '',
    formato: 'auto',
    prefix: '',
    suffix: '',
    alinhamento: 'left',
    alinhamento_vertical: 'top',
    label_tamanho_fonte: 'xs',
    label_tamanho_fonte_px: '',
    valor_tamanho_fonte: 'xl',
    valor_tamanho_fonte_px: '',
    casas_decimais: '',
    ...cell,
    ...patch,
  }
}

function extractSqlParams(sqlText) {
  if (!sqlText) return []
  // Strip -- line comments and /* */ block comments before scanning
  let stripped = sqlText
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
  const found = []
  const seen = new Set()
  const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g
  let match
  while ((match = regex.exec(stripped)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1])
      found.push(match[1])
    }
  }
  return found
}

function normalizeSqlDraft(aba) {
  const rawLayout = aba.layout_config || {}
  const normalizedLayout = Object.entries(rawLayout).reduce((acc, [key, value]) => {
    const width = LAYOUT_WIDTH_OPTIONS.some((opt) => opt.value === value?.width)
      ? value.width
      : 'full'
    acc[key] = { width }
    return acc
  }, {})

  return {
    ...aba,
    campos_join: aba.campos_join || [],
    kpis_config: aba.kpis_config || [],
    colunas_visiveis: aba.colunas_visiveis || [],
    grafico_config: { tipo: 'bar', label_col: '', series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, visivel: true, ...(aba.grafico_config || {}) },
    pivot_config: { row_field: '', col_field: '', value_field: '', agregacao: 'count', ...(aba.pivot_config || {}) },
    widget_configs: aba.widget_configs || {},
    sqls_extras: aba.sqls_extras || [],
    detail_config: { fonte_row: 0, rows: 3, cols: 2, cells: {}, ...(aba.detail_config || {}) },
    componentes_ordem: (aba.componentes_ordem || []).filter((item) =>
      SQL_COMPONENTS.includes(item) ||
      item.startsWith('campo:') ||
      item.startsWith('sql_extra:') ||
      SQL_COMPONENTS.some(t => item.startsWith(t + ':'))
    ),
    layout_config: normalizedLayout,
  }
}

function getColumnFromDrop(event) {
  return event.dataTransfer.getData('text/rx-column') || event.dataTransfer.getData('text/plain')
}

function getItemFromDrop(event, type) {
  return event.dataTransfer.getData(`text/${type}`)
}

function getCompLabel(id, widgetConfigs, sqlsExtras, componentesOrdem) {
  if (COMPONENT_LABELS[id]) return COMPONENT_LABELS[id]
  // Named instance: tipo:instanceId
  for (const tipo of SQL_COMPONENTS) {
    if (id?.startsWith(tipo + ':')) {
      const allOfType = (componentesOrdem || []).filter(c => c === tipo || c.startsWith(tipo + ':'))
      if (allOfType.length > 1) {
        const idx = allOfType.indexOf(id)
        return `${COMPONENT_LABELS[tipo]} ${idx + 1}`
      }
      return COMPONENT_LABELS[tipo]
    }
  }
  if (id?.startsWith('campo:')) {
    const wid = id.slice(6)
    const cfg = (widgetConfigs || {})[wid]
    return `Campo: ${cfg?.label || cfg?.coluna || wid}`
  }
  if (id?.startsWith('sql_extra:')) {
    const parts = id.split(':')
    const idLocal = parts[1]
    const sub = parts[2] || 'tabela'
    const extra = (sqlsExtras || []).find(e => e.id_local === idLocal)
    const subLabel = sub === 'tabela' ? 'Dados' : sub === 'grafico' ? 'Gráfico' : 'Pivot'
    return extra?.titulo ? `${extra.titulo} — ${subLabel}` : `SQL Extra — ${subLabel}`
  }
  return id
}

export default function ConfigModal() {
  const {
    abas,
    cache,
    sqls,
    theme,
    layoutPrefs,
    updateLayoutPrefs,
    resetLayoutPrefs,
    pedidoFields,
    loadSqls,
    loadColumnsForAba,
    loadColumnsForExtra,
    saveConfig,
  } = useRaioX()

  // Refs para capturar snapshot no momento da abertura sem re-disparar o useEffect
  const abasRef = useRef(abas)
  const cacheRef = useRef(cache)
  abasRef.current = abas
  cacheRef.current = cache
  const dark = theme === 'dark'

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [columnsByTabKey, setColumnsByTabKey] = useState({})
  const [columnsByExtraKey, setColumnsByExtraKey] = useState({})
  const [loadingExtraKey, setLoadingExtraKey] = useState(null)
  const [expandedSections, setExpandedSections] = useState({
    parametros: true,
    colunas: true,
    kpis: true,
    widgets: true,
    grafico: true,
    pivot: true,
    detalhe: true,
    sqls_extras: true,
    componentes: true,
  })
  const [selectedDetailCell, setSelectedDetailCell] = useState(null) // { src: 'main'|instId, row, col }
  const [dragDetailCell, setDragDetailCell] = useState(null)
  const [expandedInstances, setExpandedInstances] = useState({}) // { instId: true|false }
  const toggleInstance = (instId) => setExpandedInstances(p => ({ ...p, [instId]: !p[instId] }))

  // Reset instâncias ao trocar de aba
  useEffect(() => { setExpandedInstances({}) }, [activeIdx])

  useEffect(() => {
    const handler = () => {
      setOpen(true)
      loadSqls()
    }
    window.addEventListener('rx-open-config', handler)
    return () => window.removeEventListener('rx-open-config', handler)
  }, [loadSqls])

  // IMPORTANTE: deps apenas [open] — NÃO incluir abas/cache.
  // Se abas ou cache estiverem nas deps, qualquer execução SQL em background
  // (que atualiza cache) vai resetar o draft e apagar as edições do usuário.
  useEffect(() => {
    if (!open) return
    const snapshot = abasRef.current
    const cacheSnap = cacheRef.current
    setDraft(JSON.parse(JSON.stringify(snapshot)).map((aba) => (
      aba.tipo === 'sql' ? normalizeSqlDraft(aba) : aba
    )))
    setActiveIdx(0)
    setColumnsByTabKey(() => {
      const next = {}
      snapshot.forEach((aba) => {
        if (aba.id != null && cacheSnap[aba.id]?.cols?.length) next[aba.id] = cacheSnap[aba.id].cols
      })
      return next
    })
    // Pré-popula colunas dos SQLs extras do cache existente
    setColumnsByExtraKey(() => {
      const next = {}
      snapshot.forEach((aba) => {
        if (aba.id == null) return
        ;(aba.sqls_extras || []).forEach((extra) => {
          if (!extra.id_local) return
          const cacheKey = `${aba.id}::${extra.id_local}`
          const cols = cacheSnap[cacheKey]?.cols || []
          if (cols.length) next[extra.id_local] = cols
        })
      })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const aba = draft[activeIdx] || null
  const tabKey = aba?.id ?? `draft-${activeIdx}`

  const sqlMeta = useMemo(() => (
    sqls.find((item) => item.id === aba?.sql_extra_id) || null
  ), [sqls, aba?.sql_extra_id])

  const sqlText = sqlMeta?.sql_text || aba?.sql_text || ''
  const sqlParams = useMemo(() => extractSqlParams(sqlText), [sqlText])

  const configuredColumns = useMemo(() => {
    if (!aba || aba.tipo !== 'sql') return []
    return unique([
      ...(aba.colunas_visiveis || []),
      ...((aba.kpis_config || []).map((item) => item.coluna)),
      aba.grafico_config?.label_col,
      ...((aba.grafico_config?.series || []).map(s => s.col)),
    ])
  }, [aba])

  const availableColumns = useMemo(() => {
    if (!aba || aba.tipo !== 'sql') return []
    const cached = aba.id != null ? cache[aba.id]?.cols || [] : []
    return unique([
      ...(columnsByTabKey[tabKey] || []),
      ...cached,
      ...configuredColumns,
    ])
  }, [aba, cache, columnsByTabKey, configuredColumns, tabKey])

  const update = useCallback((field, value) => {
    setDraft((prev) => {
      const copy = [...prev]
      copy[activeIdx] = { ...copy[activeIdx], [field]: value }
      return copy
    })
  }, [activeIdx])

  const updateCurrentAba = useCallback((updater) => {
    setDraft((prev) => {
      const copy = [...prev]
      copy[activeIdx] = updater(copy[activeIdx])
      return copy
    })
  }, [activeIdx])

  const setLoadedColumns = useCallback((cols) => {
    setColumnsByTabKey((prev) => ({ ...prev, [tabKey]: cols }))
  }, [tabKey])

  const autoMatchPedidoField = useCallback((param) => {
    const low = String(param || '').toLowerCase()
    const saved = (aba?.campos_join || []).find((item) => item.coluna_sql === param)
    if (saved?.campo_pedido) return saved.campo_pedido
    for (const field of pedidoFields) {
      const normalized = field.toLowerCase()
      if (normalized === low) return field
      if (normalized.includes(low) || low.includes(normalized)) return field
    }
    return ''
  }, [aba?.campos_join, pedidoFields])

  const handleLoadColumns = useCallback(async () => {
    if (!aba?.sql_extra_id) return
    setLoadingColumns(true)
    const cols = await loadColumnsForAba(aba)
    setLoadedColumns(cols)
    updateCurrentAba((current) => {
      const next = { ...current }
      if (!(current.colunas_visiveis || []).length && cols.length) next.colunas_visiveis = cols
      if (!(current.componentes_ordem || []).length) next.componentes_ordem = [...SQL_COMPONENTS]
      return next
    })
    setLoadingColumns(false)
  }, [aba, loadColumnsForAba, setLoadedColumns, updateCurrentAba])

  const addAba = () => {
    setDraft((prev) => [...prev, {
      nome: `Nova Aba ${prev.length + 1}`,
      tipo: 'sql',
      sql_extra_id: null,
      campos_join: [],
      kpis_config: [],
      colunas_visiveis: [],
      grafico_config: { tipo: 'bar', label_col: '', series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, visivel: true },
      pivot_config: { row_field: '', col_field: '', value_field: '', agregacao: 'count' },
      widget_configs: {},
      sqls_extras: [],
      detail_config: { fonte_row: 0, rows: 3, cols: 2, cells: {} },
      componentes_ordem: [...SQL_COMPONENTS],
      layout_config: {},
      texto: '',
    }])
    setActiveIdx(draft.length)
  }

  const removeAba = (idx) => {
    if (draft.length <= 1) return
    setDraft((prev) => prev.filter((_, i) => i !== idx))
    setActiveIdx(Math.max(0, activeIdx >= idx ? activeIdx - 1 : activeIdx))
  }

  const moveAba = (idx, dir) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= draft.length) return
    setDraft((prev) => {
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
    setActiveIdx(newIdx)
  }

  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // Widget handlers
  const addWidget = () => {
    const id = `w${Date.now()}`
    const col = availableColumns[0] || ''
    const compId = `campo:${id}`
    updateCurrentAba(current => ({
      ...current,
      widget_configs: { ...(current.widget_configs || {}), [id]: { coluna: col, agregacao: 'first', label: col, estilo: {} } },
      componentes_ordem: [...(current.componentes_ordem || []), compId],
      layout_config: {
        ...(current.layout_config || {}),
        [compId]: { width: 'full' },
      },
    }))
  }

  const removeWidget = (widgetId) => {
    updateCurrentAba(current => {
      const next = { ...(current.widget_configs || {}) }
      delete next[widgetId]
      const compId = `campo:${widgetId}`
      return {
        ...current,
        widget_configs: next,
        componentes_ordem: (current.componentes_ordem || []).filter(c => c !== compId),
        layout_config: Object.fromEntries(
          Object.entries(current.layout_config || {}).filter(([key]) => key !== compId)
        ),
      }
    })
  }

  const updateWidgetInConfig = (widgetId, field, value) => {
    const configs = { ...(aba.widget_configs || {}) }
    configs[widgetId] = { ...(configs[widgetId] || {}), [field]: value }
    update('widget_configs', configs)
  }

  // SQL Extra handlers
  const addSqlExtra = () => {
    const idLocal = `se${Date.now()}`
    update('sqls_extras', [
      ...(aba.sqls_extras || []),
      { id_local: idLocal, titulo: `SQL Extra ${(aba.sqls_extras || []).length + 1}`, sql_extra_id: null, campos_join: [], colunas_visiveis: [], grafico_config: { tipo: 'bar', label_col: '', series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, visivel: true }, pivot_config: { row_field: '', col_field: '', value_field: '', agregacao: 'count' } },
    ])
  }

  const removeSqlExtra = (idLocal) => {
    updateCurrentAba((current) => ({
      ...current,
      sqls_extras: (current.sqls_extras || []).filter(e => e.id_local !== idLocal),
      componentes_ordem: (current.componentes_ordem || []).filter(c => !c.startsWith(`sql_extra:${idLocal}:`)),
      layout_config: Object.fromEntries(
        Object.entries(current.layout_config || {}).filter(([key]) => !key.startsWith(`sql_extra:${idLocal}:`))
      ),
    }))
  }

  const updateSqlExtra = (idLocal, field, value) => {
    update('sqls_extras', (aba.sqls_extras || []).map(e => e.id_local === idLocal ? { ...e, [field]: value } : e))
  }

  const updateSqlExtraSubField = (idLocal, subObj, field, value) => {
    update('sqls_extras', (aba.sqls_extras || []).map(e =>
      e.id_local === idLocal ? { ...e, [subObj]: { ...(e[subObj] || {}), [field]: value } } : e
    ))
  }

  const handleSqlExtraChange = (idLocal, sqlId) => {
    const nextSql = sqls.find(s => s.id === Number(sqlId))
    const nextParams = extractSqlParams(nextSql?.sql_text || '')
    update('sqls_extras', (aba.sqls_extras || []).map(e => {
      if (e.id_local !== idLocal) return e
      return {
        ...e,
        sql_extra_id: sqlId ? Number(sqlId) : null,
        campos_join: nextParams.map(param => {
          const existing = (e.campos_join || []).find(item => item.coluna_sql === param)
          if (existing?.campo_pedido) return existing
          const low = param.toLowerCase()
          const matched = pedidoFields.find(f => {
            const fl = f.toLowerCase()
            return fl === low || fl.includes(low) || low.includes(fl)
          })
          return { coluna_sql: param, campo_pedido: matched || '' }
        }),
      }
    }))
  }

  const setExtraJoinField = (idLocal, param, field) => {
    update('sqls_extras', (aba.sqls_extras || []).map(e => {
      if (e.id_local !== idLocal) return e
      const extraSql = sqls.find(s => s.id === e.sql_extra_id)
      const params = extractSqlParams(extraSql?.sql_text || '')
      const newCamposJoin = params.map(p => {
        const existing = (e.campos_join || []).find(item => item.coluna_sql === p)
        return { coluna_sql: p, campo_pedido: p === param ? field : (existing?.campo_pedido || '') }
      })
      return { ...e, campos_join: newCamposJoin }
    }))
  }

  const addSqlExtraComponent = (idLocal, sub) => {
    const key = `sql_extra:${idLocal}:${sub}`
    if ((aba.componentes_ordem || []).includes(key)) return
    updateCurrentAba((current) => ({
      ...current,
      componentes_ordem: [...(current.componentes_ordem || []), key],
      layout_config: {
        ...(current.layout_config || {}),
        [key]: { width: 'full' },
      },
    }))
  }

  const handleLoadColumnsForExtra = async (idLocal) => {
    setLoadingExtraKey(idLocal)
    const cols = await loadColumnsForExtra(aba, idLocal)
    setColumnsByExtraKey(prev => ({ ...prev, [idLocal]: cols }))
    if (cols.length) {
      updateSqlExtra(idLocal, 'colunas_visiveis', cols)
    }
    setLoadingExtraKey(null)
  }

  // ── Helper para instâncias nomeadas ─────────────────────────────────────
  // Retorna [getCfg, setCfg] roteados para legado (instId=null) ou instância nomeada
  const makeCfgPair = (tipo, instId) => {
    const field = TIPO_FIELDS[tipo]
    const getCfg = () => {
      if (!instId) return aba[field]
      return ((aba.widget_configs || {})[instId] || {})[field]
    }
    const setCfg = (value) => {
      if (!instId) {
        update(field, value)
      } else {
        updateCurrentAba(current => {
          const wc = { ...(current.widget_configs || {}) }
          wc[instId] = { ...(wc[instId] || {}), [field]: value }
          return { ...current, widget_configs: wc }
        })
      }
    }
    return [getCfg, setCfg]
  }
  // ─────────────────────────────────────────────────────────────────────────

  const setJoinField = (param, field) => {
    const merged = sqlParams.map((current) => {
      const existing = (aba.campos_join || []).find((item) => item.coluna_sql === current)
      return {
        coluna_sql: current,
        campo_pedido: current === param ? field : (existing?.campo_pedido || autoMatchPedidoField(current)),
      }
    })
    update('campos_join', merged.filter((item) => item.campo_pedido || item.coluna_sql))
  }

  const moveComponent = (component, targetIndex) => {
    const current = [...(aba.componentes_ordem || [])]
    const sourceIndex = current.indexOf(component)
    if (sourceIndex === -1 || sourceIndex === targetIndex) return
    update('componentes_ordem', reorder(current, sourceIndex, targetIndex))
  }

  const getComponentLayout = useCallback((componentId) => {
    const entry = (aba?.layout_config || {})[componentId] || {}
    const width = LAYOUT_WIDTH_OPTIONS.some((opt) => opt.value === entry.width)
      ? entry.width
      : 'full'
    return { width }
  }, [aba?.layout_config])

  const setComponentLayout = useCallback((componentId, patch) => {
    updateCurrentAba((current) => {
      const currentEntry = (current.layout_config || {})[componentId] || {}
      const nextWidth = patch.width ?? currentEntry.width ?? 'full'
      const width = LAYOUT_WIDTH_OPTIONS.some((opt) => opt.value === nextWidth)
        ? nextWidth
        : 'full'

      return {
        ...current,
        layout_config: {
          ...(current.layout_config || {}),
          [componentId]: { width },
        },
      }
    })
  }, [updateCurrentAba])

  const addComponent = (tipo) => {
    // Para SQL_COMPONENTS, sempre cria uma nova instância nomeada (tipo:instanceId)
    const instanceId = Math.random().toString(36).slice(2, 8)
    const compId = `${tipo}:${instanceId}`
    const defaultCfg = getDefaultInstanceConfig(tipo)
    updateCurrentAba(current => ({
      ...current,
      componentes_ordem: [...(current.componentes_ordem || []), compId],
      widget_configs: { ...(current.widget_configs || {}), [instanceId]: defaultCfg },
      layout_config: {
        ...(current.layout_config || {}),
        [compId]: { width: 'full' },
      },
    }))
    return instanceId
  }

  const removeComponent = (id) => {
    updateCurrentAba(current => {
      const wc = { ...(current.widget_configs || {}) }
      // Se for instância nomeada, limpa a config dela
      for (const tipo of SQL_COMPONENTS) {
        if (id.startsWith(tipo + ':')) {
          delete wc[id.slice(tipo.length + 1)]
          break
        }
      }
      return {
        ...current,
        componentes_ordem: (current.componentes_ordem || []).filter((item) => item !== id),
        widget_configs: wc,
        layout_config: Object.fromEntries(
          Object.entries(current.layout_config || {}).filter(([key]) => key !== id)
        ),
      }
    })
  }

  const handleSqlChange = (value) => {
    const nextSqlId = value ? Number(value) : null
    const nextSql = sqls.find((item) => item.id === nextSqlId)
    const nextParams = extractSqlParams(nextSql?.sql_text || '')
    updateCurrentAba((current) => {
      const nextOrder = current.sql_extra_id === nextSqlId ? current.componentes_ordem : [...SQL_COMPONENTS]
      const nextLayout = Object.fromEntries(
        Object.entries(current.layout_config || {}).filter(([key]) => (nextOrder || []).includes(key))
      )
      ;(nextOrder || []).forEach((key) => {
        if (!nextLayout[key]) nextLayout[key] = { width: 'full' }
      })

      return normalizeSqlDraft({
        ...current,
        sql_extra_id: nextSqlId,
        campos_join: nextParams.map((param) => {
          const existing = (current.campos_join || []).find((item) => item.coluna_sql === param)
          return {
            coluna_sql: param,
            campo_pedido: existing?.campo_pedido || autoMatchPedidoField(param),
          }
        }),
        colunas_visiveis: current.sql_extra_id === nextSqlId ? current.colunas_visiveis : [],
        kpis_config: current.sql_extra_id === nextSqlId ? current.kpis_config : [],
        grafico_config: current.sql_extra_id === nextSqlId
          ? current.grafico_config
          : { tipo: 'bar', label_col: '', series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, visivel: true },
        componentes_ordem: nextOrder,
        layout_config: nextLayout,
      })
    })
    setLoadedColumns([])
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const savedDraft = draft.map((item) => ({
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
      sql_extra_id: item.sql_extra_id,
      campos_join: item.campos_join || [],
      kpis_config: item.kpis_config || [],
      colunas_visiveis: item.colunas_visiveis || [],
      grafico_config: item.grafico_config || {},
      pivot_config: item.pivot_config || {},
      widget_configs: item.widget_configs || {},
      sqls_extras: item.sqls_extras || [],
      detail_config: item.detail_config || {},
      componentes_ordem: item.componentes_ordem || [...SQL_COMPONENTS],
      layout_config: item.layout_config || {},
      texto: item.texto || '',
    }))
    try {
      console.log('[raio-x] handleSave: chamando saveConfig, abas=', savedDraft.length, 'aba ativa idx=', activeIdx)
      savedDraft.forEach((a, i) => console.log(`[raio-x]   aba[${i}] id=${a.id} nome=${a.nome} sqls_extras=`, JSON.stringify(a.sqls_extras)))
      const result = await saveConfig(savedDraft, activeIdx)
      console.log('[raio-x] handleSave: resultado=', JSON.stringify(result))
      if (result && result.success === false) {
        setSaveError(result.message || 'Erro ao salvar. Tente novamente.')
        setSaving(false)
        return
      }
      setSaving(false)
      setOpen(false)
    } catch (e) {
      console.error('[raio-x] handleSave: EXCEÇÃO=', e)
      setSaveError(e?.message || 'Erro inesperado ao salvar.')
      setSaving(false)
    }
  }

  if (!open) return null

  // Todos os tipos sempre disponíveis para adicionar (suporte a múltiplas instâncias)
  const inactiveComponents = SQL_COMPONENTS

  const cls = {
    input: `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${dark ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-300 text-slate-800 focus:border-blue-400'}`,
    select: `w-full rounded-lg border px-3 py-2 text-sm outline-none ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`,
    label: `block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`,
    section: `rounded-lg border p-3 mb-3 ${dark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white/80'}`,
    sectionHeader: 'flex items-center justify-between cursor-pointer select-none',
    sectionTitle: `text-xs font-semibold uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-slate-600'}`,
    btn: 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
    btnPrimary: 'bg-blue-500 text-white hover:bg-blue-600',
    btnSecondary: `${dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`,
    btnDanger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded',
    dropZone: `rounded-lg border border-dashed px-3 py-2 text-xs ${dark ? 'border-slate-600 bg-slate-800/70 text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-600'}`,
    helper: `text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`,
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div
        className={`w-full max-w-6xl max-h-[92vh] flex rounded-2xl overflow-hidden ${dark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200 shadow-xl'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`w-64 flex-shrink-0 border-r p-3 flex flex-col ${dark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Abas</span>
            <button onClick={addAba} className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1`}>
              <Plus size={12} /> Nova
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {draft.map((item, index) => (
              <div
                key={item.id ?? `draft-${index}`}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer text-xs transition-colors ${
                  activeIdx === index
                    ? (dark ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-50 text-blue-600 border border-blue-200')
                    : (dark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')
                }`}
                onClick={() => setActiveIdx(index)}
              >
                <GripVertical size={10} className="opacity-40 flex-shrink-0" />
                <span className="flex-1 truncate">{item.nome || 'Sem nome'}</span>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={(event) => { event.stopPropagation(); moveAba(index, -1) }} className="p-0.5 opacity-40 hover:opacity-100" title="Subir"><ChevronUp size={10} /></button>
                  <button onClick={(event) => { event.stopPropagation(); moveAba(index, 1) }} className="p-0.5 opacity-40 hover:opacity-100" title="Descer"><ChevronDown size={10} /></button>
                  {draft.length > 1 && (
                    <button onClick={(event) => { event.stopPropagation(); removeAba(index) }} className={`p-0.5 ${cls.btnDanger}`} title="Remover"><Trash2 size={10} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div>
              <div className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>Configuração da Aba</div>
              <div className={cls.helper}>Campos, parâmetros, componentes e layout agora ficam no fluxo React.</div>
            </div>
            <button onClick={() => setOpen(false)} className={`p-1.5 rounded-lg ${dark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
              <X size={16} />
            </button>
          </div>

          {aba && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cls.label}>Nome</label>
                  <input value={aba.nome || ''} onChange={(event) => update('nome', event.target.value)} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>Tipo</label>
                  <select
                    value={aba.tipo || 'sql'}
                    onChange={(event) => updateCurrentAba((current) => (
                      event.target.value === 'sql'
                        ? normalizeSqlDraft({ ...current, tipo: event.target.value })
                        : { ...current, tipo: event.target.value }
                    ))}
                    className={cls.select}
                  >
                    {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
                  </select>
                </div>
              </div>

              {aba.tipo === 'sql' && (
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] gap-4 items-start">
                  <div className="min-w-0 space-y-3">
                    <div>
                      <label className={cls.label}>SQL Extra</label>
                      <select value={aba.sql_extra_id || ''} onChange={(event) => handleSqlChange(event.target.value)} className={cls.select}>
                        <option value="">Selecione um SQL</option>
                        {sqls.map((sql) => <option key={sql.id} value={sql.id}>{sql.nome}</option>)}
                      </select>
                    </div>

                    <div className={`${cls.section} !mb-0`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Database size={14} className={dark ? 'text-blue-400' : 'text-blue-600'} />
                          <span className={cls.sectionTitle}>Campos disponíveis do SQL</span>
                        </div>
                        <button onClick={handleLoadColumns} disabled={!aba.sql_extra_id || loadingColumns} className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1 disabled:opacity-50`}>
                          <RefreshCw size={12} className={loadingColumns ? 'animate-spin' : ''} />
                          {loadingColumns ? 'Carregando...' : 'Carregar colunas'}
                        </button>
                      </div>
                      <p className={`${cls.helper} mb-2`}>Execute uma amostra do SQL do pedido atual para descobrir as colunas reais e arraste-as para KPI, gráfico ou tabela.</p>
                      <div className="flex flex-wrap gap-2">
                        {availableColumns.length > 0 ? availableColumns.map((column) => (
                          <button
                            key={column}
                            draggable
                            type="button"
                            onDragStart={(event) => {
                              event.dataTransfer.setData('text/rx-column', column)
                              event.dataTransfer.setData('text/plain', column)
                            }}
                            onClick={() => {
                              const [gT, sT] = makeCfgPair('tabela', null)
                              const cur = gT() || []
                              sT(cur.includes(column) ? cur.filter(x => x !== column) : [...cur, column])
                            }}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              (aba.colunas_visiveis || []).includes(column)
                                ? (dark ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')
                                : (dark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/40' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300')
                            }`}
                            title="Clique para incluir na tabela ou arraste para uma área de destino"
                          >
                            {column}
                          </button>
                        )) : (
                          <div className={cls.dropZone}>Nenhuma coluna carregada ainda.</div>
                        )}
                      </div>
                    </div>

                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('parametros')}>
                        <span className={cls.sectionTitle}>Parâmetros do SQL</span>
                        {expandedSections.parametros ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                      {expandedSections.parametros && (
                        <div className="mt-3 space-y-2">
                          {sqlParams.length > 0 ? sqlParams.map((param) => {
                            const selected = (aba.campos_join || []).find((item) => item.coluna_sql === param)?.campo_pedido || autoMatchPedidoField(param)
                            return (
                              <div key={param} className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1.2fr)] gap-2 items-center">
                                <div className={cls.dropZone}>
                                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Parâmetro</div>
                                  <div className="font-mono font-semibold">:{param}</div>
                                </div>
                                <div className="text-center opacity-50">↔</div>
                                <div>
                                  <select value={selected} onChange={(event) => setJoinField(param, event.target.value)} className={cls.select}>
                                    <option value="">Selecione um campo do pedido</option>
                                    {pedidoFields.map((field) => <option key={field} value={field}>{field}</option>)}
                                  </select>
                                </div>
                              </div>
                            )
                          }) : (
                            <p className={cls.helper}>Esse SQL não possui parâmetros nomeados.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('colunas')}>
                        <span className={cls.sectionTitle}>Tabela e colunas visíveis</span>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Adicionar nova Tabela" onClick={e => { e.stopPropagation(); const id = addComponent('tabela'); setExpandedInstances(p => ({ ...p, [id]: true })) }} className={`p-0.5 rounded ${dark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'}`}><Plus size={13} /></button>
                          {expandedSections.colunas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {expandedSections.colunas && (
                        <div className="mt-3 space-y-2">
                          {[null, ...(aba.componentes_ordem || []).filter(c => c.startsWith('tabela:'))].map((compId, blockIdx) => {
                            const instId = compId ? compId.slice(7) : null
                            const isPrincipal = !compId
                            const [getT, setT] = makeCfgPair('tabela', instId)
                            const toggleCol = col => { const c = getT() || []; setT(c.includes(col) ? c.filter(x => x !== col) : [...c, col]) }
                            const moveCol = (col, idx) => { const c = [...(getT() || [])]; const from = c.indexOf(col); if (from === -1 || from === idx) return; setT(reorder(c, from, idx)) }
                            const isOpen = isPrincipal || expandedInstances[instId] !== false
                            return (
                              <div key={compId || 'principal'}>
                                {!isPrincipal && (
                                  <div className={`flex items-center justify-between cursor-pointer select-none border-t mt-2 pt-2 ${dark ? 'border-slate-700' : 'border-slate-200'}`} onClick={() => toggleInstance(instId)}>
                                    <span className={`text-xs font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Tabela {blockIdx}</span>
                                    <div className="flex items-center gap-1">
                                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      <button type="button" onClick={e => { e.stopPropagation(); removeComponent(compId) }} className={`${cls.btnDanger} p-0.5`} title="Remover tabela"><Minus size={12} /></button>
                                    </div>
                                  </div>
                                )}
                                {isOpen && (
                                  <div className="flex flex-col gap-3 mt-2">
                                    <div>
                                      <div className={`${cls.helper} mb-2`}>Selecione as colunas que a tabela deve mostrar.</div>
                                      <div className={`rounded-lg border max-h-48 overflow-y-auto ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
                                        {availableColumns.length > 0 ? availableColumns.map((column) => (
                                          <label key={column} title={column} className={`flex w-full items-center justify-start gap-1.5 px-2 py-1.5 text-left text-xs cursor-pointer ${dark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}>
                                            <input type="checkbox" className="mt-0 h-3.5 w-3.5 flex-shrink-0 self-center" checked={(getT() || []).includes(column)} onChange={() => toggleCol(column)} />
                                            <span className="block min-w-0 flex-1 truncate text-left">{column}</span>
                                          </label>
                                        )) : (
                                          <div className="p-3 text-xs text-slate-500">Carregue as colunas do SQL para configurar a tabela.</div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <div className={`${cls.helper} mb-2`}>Ordem da tabela. Arraste para reordenar.</div>
                                      <div className={`rounded-lg border min-h-[80px] p-2 space-y-1 ${dark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'}`}>
                                        {(getT() || []).length > 0 ? (getT() || []).map((column, index) => (
                                          <div
                                            key={column}
                                            draggable
                                            onDragStart={(event) => event.dataTransfer.setData('text/visible-column', column)}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={(event) => {
                                              event.preventDefault()
                                              const dragged = getItemFromDrop(event, 'visible-column') || getColumnFromDrop(event)
                                              if (!dragged) return
                                              if (!(getT() || []).includes(dragged)) { setT(unique([...(getT() || []), dragged])); return }
                                              moveCol(dragged, index)
                                            }}
                                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${dark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'}`}
                                          >
                                            <GripVertical size={11} className="opacity-40 flex-shrink-0" />
                                            <span className="flex-1 truncate" title={column}>{column}</span>
                                            <button onClick={() => toggleCol(column)} className={cls.btnDanger}><Trash2 size={12} /></button>
                                          </div>
                                        )) : (
                                          <div
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={(event) => { event.preventDefault(); const col = getColumnFromDrop(event); if (col) setT(unique([...(getT() || []), col])) }}
                                            className={cls.dropZone}
                                          >
                                            Arraste colunas para montar a tabela.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('kpis')}>
                        <span className={cls.sectionTitle}>Indicadores (KPIs)</span>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Adicionar novo grupo de KPIs" onClick={e => { e.stopPropagation(); const id = addComponent('kpis'); setExpandedInstances(p => ({ ...p, [id]: true })) }} className={`p-0.5 rounded ${dark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'}`}><Plus size={13} /></button>
                          {expandedSections.kpis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {expandedSections.kpis && (
                        <div className="mt-3 space-y-2">
                          {[null, ...(aba.componentes_ordem || []).filter(c => c.startsWith('kpis:'))].map((compId, blockIdx) => {
                            const instId = compId ? compId.slice(5) : null
                            const isPrincipal = !compId
                            const [getK, setK] = makeCfgPair('kpis', instId)
                            const addKpi = () => setK([...(getK() || []), { coluna: availableColumns[0] || '', agregacao: 'count', label: '' }])
                            const updateKpi = (i, field, value) => { const arr = [...(getK() || [])]; arr[i] = { ...arr[i], [field]: value }; setK(arr) }
                            const removeKpi = (i) => setK((getK() || []).filter((_, j) => j !== i))
                            const isOpen = isPrincipal || expandedInstances[instId] !== false
                            return (
                              <div key={compId || 'principal'}>
                                {!isPrincipal && (
                                  <div className={`flex items-center justify-between cursor-pointer select-none border-t mt-2 pt-2 ${dark ? 'border-slate-700' : 'border-slate-200'}`} onClick={() => toggleInstance(instId)}>
                                    <span className={`text-xs font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Indicadores {blockIdx}</span>
                                    <div className="flex items-center gap-1">
                                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      <button type="button" onClick={e => { e.stopPropagation(); removeComponent(compId) }} className={`${cls.btnDanger} p-0.5`} title="Remover grupo de indicadores"><Minus size={12} /></button>
                                    </div>
                                  </div>
                                )}
                                {isOpen && (
                                  <>
                                    {(getK() || []).map((kpi, index) => (
                                      <div key={`kpi-${index}`} className={`grid grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_32px] gap-2 items-center rounded-lg p-2 ${dark ? 'bg-slate-950/40' : 'bg-slate-50/80'}`}>
                                        <div
                                          onDragOver={(event) => event.preventDefault()}
                                          onDrop={(event) => { event.preventDefault(); const column = getColumnFromDrop(event); if (column) updateKpi(index, 'coluna', column) }}
                                        >
                                          <label className={cls.label}>Coluna</label>
                                          <select value={kpi.coluna || ''} onChange={(event) => updateKpi(index, 'coluna', event.target.value)} className={cls.select}>
                                            <option value="">Selecione a coluna</option>
                                            {availableColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label className={cls.label}>Agregação</label>
                                          <select value={kpi.agregacao || 'count'} onChange={(event) => updateKpi(index, 'agregacao', event.target.value)} className={cls.select}>
                                            {AGREGACOES.map((agregacao) => <option key={agregacao.value} value={agregacao.value}>{agregacao.label}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label className={cls.label}>Label</label>
                                          <input placeholder="Ex.: Total em aberto" value={kpi.label || ''} onChange={(event) => updateKpi(index, 'label', event.target.value)} className={cls.input} />
                                        </div>
                                        <button onClick={() => removeKpi(index)} className={`${cls.btnDanger} mt-5`}><Trash2 size={14} /></button>
                                      </div>
                                    ))}
                                    <button onClick={addKpi} className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1`}>
                                      <Plus size={12} /> Adicionar KPI
                                    </button>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Widgets de Campo ── */}
                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('widgets')}>
                        <span className={cls.sectionTitle}>Widgets de Campo</span>
                        {expandedSections.widgets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                      {expandedSections.widgets && (
                        <div className="mt-3 space-y-2">
                          <p className={cls.helper}>Cada widget exibe um valor de uma coluna do SQL como card individual no dashboard. Widgets consecutivos ficam lado a lado.</p>
                          {Object.entries(aba.widget_configs || {}).map(([widgetId, cfg]) => (
                            <div key={widgetId} className={`grid grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_32px] gap-2 items-center rounded-lg p-2 ${dark ? 'bg-slate-950/40' : 'bg-slate-50/80'}`}>
                              <div>
                                <label className={cls.label}>Coluna</label>
                                <select value={cfg.coluna || ''} onChange={e => updateWidgetInConfig(widgetId, 'coluna', e.target.value)} className={cls.select}>
                                  <option value="">Selecione</option>
                                  {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className={cls.label}>Agregação</label>
                                <select value={cfg.agregacao || 'first'} onChange={e => updateWidgetInConfig(widgetId, 'agregacao', e.target.value)} className={cls.select}>
                                  {AGREGACOES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className={cls.label}>Label</label>
                                <input value={cfg.label || ''} onChange={e => updateWidgetInConfig(widgetId, 'label', e.target.value)} placeholder={cfg.coluna || ''} className={cls.input} />
                              </div>
                              <button onClick={() => removeWidget(widgetId)} className={`${cls.btnDanger} mt-5`}><Trash2 size={14} /></button>
                            </div>
                          ))}
                          <button onClick={addWidget} className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1`}>
                            <Plus size={12} /> Adicionar Widget
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('grafico')}>
                        <span className={cls.sectionTitle}>Gráfico</span>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Adicionar novo Gráfico" onClick={e => { e.stopPropagation(); const id = addComponent('grafico'); setExpandedInstances(p => ({ ...p, [id]: true })) }} className={`p-0.5 rounded ${dark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'}`}><Plus size={13} /></button>
                          {expandedSections.grafico ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {expandedSections.grafico && (
                        <div className="mt-3 space-y-3">
                          {[null, ...(aba.componentes_ordem || []).filter(c => c.startsWith('grafico:'))].map((compId, blockIdx) => {
                            const instId = compId ? compId.slice(8) : null
                            const isPrincipal = !compId
                            const [getG, setG] = makeCfgPair('grafico', instId)
                            const DEFAULT_COLORS_G = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']
                            const gcfgRaw = getG() || aba.grafico_config || {}
                            const gcfg = { tipo: 'bar', label_col: '', series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, visivel: true, ...gcfgRaw }
                            const setField = (field, value) => setG({ ...gcfg, [field]: value })
                            const updateGSerie = (idx, patch) => { const ns = [...(gcfg.series||[])]; ns[idx]={...ns[idx],...patch}; setField('series', ns) }
                            const addGSerie = () => { const used=new Set((gcfg.series||[]).map(s=>s.col)); const col=availableColumns.find(c=>c!==gcfg.label_col&&!used.has(c))||''; const ci=(gcfg.series||[]).length; setField('series',[...(gcfg.series||[]),{col,label:col,color:DEFAULT_COLORS_G[ci%DEFAULT_COLORS_G.length],type:'bar'}]) }
                            const removeGSerie = (idx) => setField('series',(gcfg.series||[]).filter((_,i)=>i!==idx))
                            const isOpen = isPrincipal || expandedInstances[instId] !== false
                            return (
                              <div key={compId || 'principal'}>
                                {!isPrincipal && (
                                  <div className={`flex items-center justify-between cursor-pointer select-none border-t mt-2 pt-2 ${dark ? 'border-slate-700' : 'border-slate-200'}`} onClick={() => toggleInstance(instId)}>
                                    <span className={`text-xs font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Gráfico {blockIdx}</span>
                                    <div className="flex items-center gap-1">
                                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      <button type="button" onClick={e => { e.stopPropagation(); removeComponent(compId) }} className={`${cls.btnDanger} p-0.5`} title="Remover gráfico"><Minus size={12} /></button>
                                    </div>
                                  </div>
                                )}
                                {isOpen && (
                                  <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-xs">
                                      <input type="checkbox" checked={gcfg.visivel !== false} onChange={e => setField('visivel', e.target.checked)} />
                                      <span className={dark ? 'text-slate-300' : 'text-slate-700'}>Exibir gráfico</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className={cls.label}>Tipo de gráfico</label>
                                        <select value={gcfg.tipo||'bar'} onChange={e=>setField('tipo',e.target.value)} className={cls.select}>
                                          {CHART_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                      </div>
                                      <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const col=getColumnFromDrop(e);if(col)setField('label_col',col)}}>
                                        <label className={cls.label}>Eixo X (categoria)</label>
                                        <select value={gcfg.label_col||''} onChange={e=>setField('label_col',e.target.value)} className={cls.select}>
                                          <option value="">— Selecione —</option>
                                          {availableColumns.map(c=><option key={c} value={c}>{c}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className={cls.label}>Séries / Valores</label>
                                        <button type="button" onClick={addGSerie} className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1 text-xs`}><Plus size={10}/> Série</button>
                                      </div>
                                      {!(gcfg.series?.length) && <p className={cls.helper}>Clique em "+ Série" para adicionar uma coluna de valores.</p>}
                                      <div className="space-y-2">
                                        {(gcfg.series||[]).map((s,si)=>(
                                          <div key={si} className={`rounded border p-2 grid gap-1.5 ${dark?'border-slate-700 bg-slate-950/40':'border-slate-200 bg-slate-50'}`}>
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className={`${cls.label}`}>Coluna</label>
                                                <select value={s.col||''} onChange={e=>updateGSerie(si,{col:e.target.value,label:s.label||e.target.value})} className={cls.select}>
                                                  <option value="">— Selecione —</option>
                                                  {availableColumns.filter(c=>c!==gcfg.label_col).map(c=><option key={c} value={c}>{c}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Rótulo</label>
                                                <input value={s.label||''} onChange={e=>updateGSerie(si,{label:e.target.value})} placeholder={s.col||'Série'} className={cls.input}/>
                                              </div>
                                            </div>
                                            <div className="flex items-end gap-2">
                                              <div className="flex-1">
                                                <label className={cls.label}>Tipo{gcfg.tipo!=='mixed'?' (só no modo Misto)':''}</label>
                                                <select value={s.type||'bar'} onChange={e=>updateGSerie(si,{type:e.target.value})} className={cls.select} disabled={gcfg.tipo!=='mixed'}>
                                                  {SERIE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Cor</label>
                                                <div className="flex gap-1 items-center">
                                                  <input type="color" value={s.color||DEFAULT_COLORS_G[si%DEFAULT_COLORS_G.length]} onChange={e=>updateGSerie(si,{color:e.target.value})} className="w-8 h-8 p-0.5 rounded border-0 cursor-pointer" style={{background:'transparent'}}/>
                                                  <input value={s.color||DEFAULT_COLORS_G[si%DEFAULT_COLORS_G.length]} onChange={e=>updateGSerie(si,{color:e.target.value})} className={`${cls.input} font-mono`} style={{width:72}}/>
                                                </div>
                                              </div>
                                              <button onClick={()=>removeGSerie(si)} className={`${cls.btnDanger} p-1`} title="Remover série"><Trash2 size={12}/></button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <label className={cls.label}>Formato dos valores</label>
                                      <div className="flex flex-wrap gap-1.5">
                                        {VALUE_FORMATS.map(f=>(
                                          <button key={f.value} type="button" onClick={()=>setField('format',f.value)}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                                              (gcfg.format||'auto')===f.value
                                                ?(dark?'bg-blue-500/20 border-blue-500/40 text-blue-300':'bg-blue-50 border-blue-300 text-blue-700')
                                                :(dark?'border-slate-700 text-slate-400 hover:border-slate-500':'border-slate-200 text-slate-600 hover:border-slate-400')
                                            }`}
                                          >{f.label}</button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                      {[{key:'stacked',label:'Empilhado'},{key:'show_legend',label:'Legenda'},{key:'show_data_labels',label:'Rótulos nas barras'}].map(({key,label})=>(
                                        <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                                          <input type="checkbox" checked={!!gcfg[key]} onChange={e=>setField(key,e.target.checked)} className="w-3.5 h-3.5 rounded accent-blue-500"/>
                                          <span className={`text-xs ${dark?'text-slate-300':'text-slate-700'}`}>{label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('pivot')}>
                        <span className={cls.sectionTitle}>Tabela Pivot</span>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Adicionar nova Tabela Pivot" onClick={e => { e.stopPropagation(); const id = addComponent('pivot'); setExpandedInstances(p => ({ ...p, [id]: true })) }} className={`p-0.5 rounded ${dark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'}`}><Plus size={13} /></button>
                          {expandedSections.pivot ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {expandedSections.pivot && (
                        <div className="mt-3 space-y-3">
                          {[null, ...(aba.componentes_ordem || []).filter(c => c.startsWith('pivot:'))].map((compId, blockIdx) => {
                            const instId = compId ? compId.slice(6) : null
                            const isPrincipal = !compId
                            const [getP, setP] = makeCfgPair('pivot', instId)
                            const pcfg = getP() || aba.pivot_config || {}
                            const setField = (field, value) => setP({ ...pcfg, [field]: value })
                            const isOpen = isPrincipal || expandedInstances[instId] !== false
                            return (
                              <div key={compId || 'principal'}>
                                {!isPrincipal && (
                                  <div className={`flex items-center justify-between cursor-pointer select-none border-t mt-2 pt-2 ${dark ? 'border-slate-700' : 'border-slate-200'}`} onClick={() => toggleInstance(instId)}>
                                    <span className={`text-xs font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Pivot {blockIdx}</span>
                                    <div className="flex items-center gap-1">
                                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      <button type="button" onClick={e => { e.stopPropagation(); removeComponent(compId) }} className={`${cls.btnDanger} p-0.5`} title="Remover pivot"><Minus size={12} /></button>
                                    </div>
                                  </div>
                                )}
                                {isOpen && (
                                  <>
                                    <p className={cls.helper}>Cruza dois campos categóricos com um campo numérico, mostrando a agregação em cada célula da matriz.</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const c = getColumnFromDrop(e); if (c) setField('row_field', c) }}>
                                        <label className={cls.label}>Linhas (campo categórico)</label>
                                        <select value={pcfg.row_field || ''} onChange={e => setField('row_field', e.target.value)} className={cls.select}>
                                          <option value="">Selecione</option>
                                          {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      </div>
                                      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const c = getColumnFromDrop(e); if (c) setField('col_field', c) }}>
                                        <label className={cls.label}>Colunas (campo categórico)</label>
                                        <select value={pcfg.col_field || ''} onChange={e => setField('col_field', e.target.value)} className={cls.select}>
                                          <option value="">Selecione</option>
                                          {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      </div>
                                      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const c = getColumnFromDrop(e); if (c) setField('value_field', c) }}>
                                        <label className={cls.label}>Valor (campo numérico)</label>
                                        <select value={pcfg.value_field || ''} onChange={e => setField('value_field', e.target.value)} className={cls.select}>
                                          <option value="">Selecione</option>
                                          {availableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className={cls.label}>Agregação</label>
                                        <select value={pcfg.agregacao || 'count'} onChange={e => setField('agregacao', e.target.value)} className={cls.select}>
                                          <option value="count">Contagem</option>
                                          <option value="sum">Soma</option>
                                          <option value="avg">Média</option>
                                          <option value="max">Máximo</option>
                                          <option value="min">Mínimo</option>
                                        </select>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Painel de Detalhe ── */}
                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('detalhe')}>
                        <span className={cls.sectionTitle}>Painel de Detalhe</span>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Adicionar novo Painel de Detalhe" onClick={e => { e.stopPropagation(); const id = addComponent('detalhe'); setExpandedInstances(p => ({ ...p, [id]: true })) }} className={`p-0.5 rounded ${dark ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600'}`}><Plus size={13} /></button>
                          {expandedSections.detalhe ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {expandedSections.detalhe && (
                        <div className="mt-3 space-y-3">
                          <p className={cls.helper}>Defina a grade (linhas × colunas) e clique em cada célula para configurar um campo do SQL ou um texto fixo.</p>
                          {[null, ...(aba.componentes_ordem || []).filter(c => c.startsWith('detalhe:'))].map((compId, blockIdx) => {
                            const instId = compId ? compId.slice(8) : null
                            const isPrincipal = !compId
                            const [getD, setD] = makeCfgPair('detalhe', instId)
                            const srcKey = instId || 'main'
                            const isOpen = isPrincipal || expandedInstances[instId] !== false
                            return (
                              <div key={compId || 'principal'}>
                                {!isPrincipal && (
                                  <div className={`flex items-center justify-between cursor-pointer select-none border-t mt-2 pt-2 ${dark ? 'border-slate-700' : 'border-slate-200'}`} onClick={() => toggleInstance(instId)}>
                                    <span className={`text-xs font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Painel {blockIdx}</span>
                                    <div className="flex items-center gap-1">
                                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      <button type="button" onClick={e => { e.stopPropagation(); removeComponent(compId) }} className={`${cls.btnDanger} p-0.5`} title="Remover painel"><Minus size={12} /></button>
                                    </div>
                                  </div>
                                )}
                                {isOpen && (
                                  <>
                                    <div className="flex items-end gap-3 flex-wrap">
                                      <div>
                                        <label className={cls.label}>Linha de origem (0 = primeira)</label>
                                        <input type="number" min={0}
                                          value={(getD() || {}).fonte_row ?? 0}
                                          onChange={e => setD({ ...(getD() || {}), fonte_row: Number(e.target.value) })}
                                          className={`w-20 rounded-lg border px-3 py-1.5 text-sm ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                        />
                                      </div>
                                      <div>
                                        <label className={cls.label}>Linhas</label>
                                        <input type="number" min={1} max={12}
                                          value={(getD() || {}).rows ?? 3}
                                          onChange={e => setD({ ...(getD() || {}), rows: Number(e.target.value) })}
                                          className={`w-20 rounded-lg border px-3 py-1.5 text-sm ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                        />
                                      </div>
                                      <div>
                                        <label className={cls.label}>Colunas</label>
                                        <input type="number" min={1} max={6}
                                          value={(getD() || {}).cols ?? 2}
                                          onChange={e => setD({ ...(getD() || {}), cols: Number(e.target.value) })}
                                          className={`w-20 rounded-lg border px-3 py-1.5 text-sm ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                        />
                                      </div>
                                    </div>
                                    {(() => {
                                      const dcfg = { fonte_row: 0, rows: 3, cols: 2, cells: {}, ...(getD() || {}) }
                                      const { rows, cols, cells } = dcfg
                                      const selKey = selectedDetailCell?.src === srcKey
                                        ? `${selectedDetailCell.row},${selectedDetailCell.col}` : null
                                      const setCell = (key, patch) => setD({
                                        ...dcfg, cells: { ...cells, [key]: makeDefaultDetailCell(cells[key] || {}, patch) }
                                      })
                                      const clearCell = (key) => {
                                        const next = { ...cells }; delete next[key]
                                        setD({ ...dcfg, cells: next })
                                        setSelectedDetailCell(null)
                                      }
                                      const swapCells = (keyA, keyB) => {
                                        const cellA = cells[keyA]; const cellB = cells[keyB]
                                        const next = { ...cells }
                                        if (cellA) next[keyB] = cellA; else delete next[keyB]
                                        if (cellB) next[keyA] = cellB; else delete next[keyA]
                                        setD({ ...dcfg, cells: next })
                                      }
                                      const cell = selKey ? makeDefaultDetailCell(cells[selKey] || {}) : null
                                      return (
                                        <>
                                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: '4px' }}>
                                            {Array.from({ length: rows }, (_, r) =>
                                              Array.from({ length: cols }, (_, c) => {
                                                const key = `${r},${c}`
                                                const cv = cells[key]
                                                const isSel = selKey === key
                                                return (
                                                  <button key={key} type="button"
                                                    draggable
                                                    onDragStart={e => { e.dataTransfer.setData('text/detail-cell', key); setDragDetailCell(key) }}
                                                    onDragOver={e => e.preventDefault()}
                                                    onDrop={e => { e.preventDefault(); const s2 = e.dataTransfer.getData('text/detail-cell'); if (s2 && s2 !== key) swapCells(s2, key); setDragDetailCell(null) }}
                                                    onDragEnd={() => setDragDetailCell(null)}
                                                    onClick={() => setSelectedDetailCell(isSel ? null : { src: srcKey, row: r, col: c })}
                                                    className={`rounded border p-2 text-left min-h-[46px] transition-all select-none ${
                                                      dragDetailCell === key
                                                        ? 'opacity-30 scale-95 cursor-grabbing'
                                                        : isSel
                                                          ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30 cursor-grab'
                                                          : cv
                                                            ? (dark ? 'border-slate-600 bg-slate-800 hover:border-blue-500/50 cursor-grab' : 'border-slate-300 bg-white hover:border-blue-400 cursor-grab')
                                                            : (dark ? 'border-slate-700 border-dashed bg-transparent hover:border-slate-500 cursor-grab' : 'border-slate-200 border-dashed hover:border-slate-400 cursor-grab')
                                                    }`}
                                                  >
                                                    {cv ? (
                                                      cv.tipo === 'texto' ? (
                                                        <span className={`block text-[11px] leading-tight ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{cv.valor || <em className="opacity-40">texto vazio</em>}</span>
                                                      ) : (
                                                        <>
                                                          <span className={`block text-[10px] mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{cv.label || <em>sem label</em>}</span>
                                                          <span className={`block text-[11px] font-medium ${isSel ? 'text-blue-400' : (dark ? 'text-slate-200' : 'text-slate-700')}`}>{cv.coluna || '—'}</span>
                                                        </>
                                                      )
                                                    ) : (
                                                      <span className={`text-[11px] ${dark ? 'text-slate-600' : 'text-slate-300'}`}>+ clique</span>
                                                    )}
                                                  </button>
                                                )
                                              })
                                            )}
                                          </div>
                                          {cell && selKey && (
                                            <div className={`rounded-lg border p-3 space-y-2.5 ${dark ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50/60'}`}>
                                              <div className="flex items-center justify-between">
                                                <span className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-blue-400' : 'text-blue-600'}`}>
                                                  Célula {selectedDetailCell.row + 1} × {selectedDetailCell.col + 1}
                                                </span>
                                                <button onClick={() => clearCell(selKey)} className="text-[11px] text-red-400 hover:text-red-300 hover:underline">Limpar célula</button>
                                              </div>
                                              <div className="flex gap-4">
                                                {['campo', 'texto'].map(t => (
                                                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                                                    <input type="radio" checked={(cell.tipo || 'campo') === t} onChange={() => setCell(selKey, { tipo: t })} />
                                                    {t === 'campo' ? 'Campo SQL' : 'Texto livre'}
                                                  </label>
                                                ))}
                                              </div>
                                              {(cell.tipo || 'campo') === 'campo' ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                  <div>
                                                    <label className={cls.label}>Coluna</label>
                                                    <select value={cell.coluna || ''} onChange={e => setCell(selKey, { coluna: e.target.value })} className={cls.select}>
                                                      <option value="">Selecione</option>
                                                      {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Label</label>
                                                    <input value={cell.label || ''} onChange={e => setCell(selKey, { label: e.target.value })} placeholder="Ex: Cliente" className={cls.input} />
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Formato</label>
                                                    <select value={cell.formato || 'auto'} onChange={e => setCell(selKey, { formato: e.target.value })} className={cls.select}>
                                                      {VALUE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Prefixo</label>
                                                    <input value={cell.prefix || ''} onChange={e => setCell(selKey, { prefix: e.target.value })} placeholder="Ex: R$  ·  %  ·  Venc:" className={cls.input} />
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Sufixo</label>
                                                    <input value={cell.suffix || ''} onChange={e => setCell(selKey, { suffix: e.target.value })} placeholder="Ex: %" className={cls.input} />
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Casas decimais</label>
                                                    <input type="number" min={0} max={6} value={cell.casas_decimais ?? ''} onChange={e => setCell(selKey, { casas_decimais: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Auto" className={cls.input} />
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Alinhamento</label>
                                                    <select value={cell.alinhamento || 'left'} onChange={e => setCell(selKey, { alinhamento: e.target.value })} className={cls.select}>
                                                      {TEXT_ALIGN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Alinhamento vertical</label>
                                                    <select value={cell.alinhamento_vertical || 'top'} onChange={e => setCell(selKey, { alinhamento_vertical: e.target.value })} className={cls.select}>
                                                      {VERTICAL_ALIGN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Tamanho do label</label>
                                                    <select value={cell.label_tamanho_fonte || 'xs'} onChange={e => setCell(selKey, { label_tamanho_fonte: e.target.value })} className={cls.select}>
                                                      {FONT_SIZE_PRESETS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Label px</label>
                                                    <input type="number" min={8} max={72} value={cell.label_tamanho_fonte_px ?? ''} onChange={e => setCell(selKey, { label_tamanho_fonte_px: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Preset" className={cls.input} />
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Tamanho do valor</label>
                                                    <select value={cell.valor_tamanho_fonte || 'xl'} onChange={e => setCell(selKey, { valor_tamanho_fonte: e.target.value })} className={cls.select}>
                                                      {FONT_SIZE_PRESETS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                  </div>
                                                  <div>
                                                    <label className={cls.label}>Valor px</label>
                                                    <input type="number" min={8} max={120} value={cell.valor_tamanho_fonte_px ?? ''} onChange={e => setCell(selKey, { valor_tamanho_fonte_px: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Preset" className={cls.input} />
                                                  </div>
                                                </div>
                                              ) : (
                                                <div>
                                                  <label className={cls.label}>Conteúdo</label>
                                                  <input value={cell.valor || ''} onChange={e => setCell(selKey, { valor: e.target.value })} placeholder="Texto fixo que aparece na célula" className={cls.input} />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── SQLs Adicionais ── */}
                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('sqls_extras')}>
                        <span className={cls.sectionTitle}>SQLs Adicionais</span>
                        {expandedSections.sqls_extras ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                      {expandedSections.sqls_extras && (
                        <div className="mt-3 space-y-3">
                          <p className={cls.helper}>Adicione consultas SQL extras a esta aba. Cada uma pode ter tabela, gráfico e/ou pivot independentes.</p>
                          {(aba.sqls_extras || []).map(extra => {
                            const extraCols = columnsByExtraKey[extra.id_local] || []
                            return (
                              <div key={extra.id_local} className={`rounded-lg border p-3 space-y-2 ${dark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/60'}`}>
                                <div className="flex items-center gap-2">
                                  <input
                                    value={extra.titulo || ''}
                                    onChange={e => updateSqlExtra(extra.id_local, 'titulo', e.target.value)}
                                    placeholder="Título do bloco"
                                    className={`flex-1 text-sm rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                  />
                                  <button onClick={() => removeSqlExtra(extra.id_local)} className={`${cls.btnDanger} p-1`}><Trash2 size={13} /></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className={cls.label}>SQL Extra</label>
                                    <select value={extra.sql_extra_id || ''} onChange={e => handleSqlExtraChange(extra.id_local, e.target.value)} className={cls.select}>
                                      <option value="">Selecione</option>
                                      {sqls.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex items-end">
                                    <button
                                      onClick={() => handleLoadColumnsForExtra(extra.id_local)}
                                      disabled={!extra.sql_extra_id || loadingExtraKey === extra.id_local}
                                      className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1 disabled:opacity-50`}
                                    >
                                      <RefreshCw size={12} className={loadingExtraKey === extra.id_local ? 'animate-spin' : ''} />
                                      {loadingExtraKey === extra.id_local ? 'Carregando...' : 'Carregar colunas'}
                                    </button>
                                  </div>
                                </div>
                                {extra.sql_extra_id && (() => {
                                  const extraSqlMeta = sqls.find(s => s.id === extra.sql_extra_id)
                                  const extraParams = extractSqlParams(extraSqlMeta?.sql_text || '')
                                  if (!extraParams.length) return null
                                  return (
                                    <div>
                                      <label className={cls.label}>Parâmetros do SQL</label>
                                      <div className="space-y-1.5">
                                        {extraParams.map(param => {
                                          const selectedField = (extra.campos_join || []).find(item => item.coluna_sql === param)?.campo_pedido || ''
                                          return (
                                            <div key={param} className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1.2fr)] gap-2 items-center">
                                              <div className={cls.dropZone}>
                                                <div className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Parâmetro</div>
                                                <div className="font-mono font-semibold text-xs">:{param}</div>
                                              </div>
                                              <div className="text-center opacity-50 text-xs">↔</div>
                                              <div>
                                                <select value={selectedField} onChange={e => setExtraJoinField(extra.id_local, param, e.target.value)} className={cls.select}>
                                                  <option value="">Selecione um campo do pedido</option>
                                                  {pedidoFields.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })()}
                                {extraCols.length > 0 && (
                                  <div>
                                    <label className={cls.label}>Colunas visíveis na tabela</label>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {extraCols.map(c => (
                                        <button
                                          key={c}
                                          type="button"
                                          onClick={() => {
                                            const cur = extra.colunas_visiveis || []
                                            updateSqlExtra(extra.id_local, 'colunas_visiveis', cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c])
                                          }}
                                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${(extra.colunas_visiveis || []).includes(c) ? (dark ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700') : (dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')}`}
                                        >{c}</button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {extraCols.length > 0 && (aba.componentes_ordem || []).includes(`sql_extra:${extra.id_local}:grafico`) && (
                                  <div className={`rounded border p-2 space-y-1.5 ${dark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-white/70'}`}>
                                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Configuração do Gráfico</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className={cls.label}>Tipo</label>
                                        <select value={(extra.grafico_config || {}).tipo || 'bar'} onChange={e => updateSqlExtraSubField(extra.id_local, 'grafico_config', 'tipo', e.target.value)} className={cls.select}>
                                          {CHART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className={cls.label}>Eixo X</label>
                                        <select value={(extra.grafico_config || {}).label_col || ''} onChange={e => updateSqlExtraSubField(extra.id_local, 'grafico_config', 'label_col', e.target.value)} className={cls.select}>
                                          <option value="">Selecione a coluna</option>
                                          {extraCols.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className={cls.label}>Valor</label>
                                        <select value={(extra.grafico_config || {}).value_col || ''} onChange={e => updateSqlExtraSubField(extra.id_local, 'grafico_config', 'value_col', e.target.value)} className={cls.select}>
                                          <option value="">Selecione a coluna</option>
                                          {extraCols.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <label className={cls.label}>Adicionar ao dashboard</label>
                                  <div className="flex flex-wrap gap-2">
                                    {['tabela', 'grafico', 'pivot', 'detalhe'].map(sub => {
                                      const key = `sql_extra:${extra.id_local}:${sub}`
                                      const active = (aba.componentes_ordem || []).includes(key)
                                      const lbl = sub === 'tabela' ? 'Tabela' : sub === 'grafico' ? 'Gráfico' : sub === 'pivot' ? 'Pivot' : 'Painel de Detalhe'
                                      return (
                                        <button
                                          key={sub}
                                          type="button"
                                          onClick={() => active ? removeComponent(key) : addSqlExtraComponent(extra.id_local, sub)}
                                          className={`${cls.btn} text-xs ${active ? cls.btnPrimary : cls.btnSecondary}`}
                                        >
                                          {active ? '✓ ' : '+ '}{lbl}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                                {(aba.componentes_ordem || []).includes(`sql_extra:${extra.id_local}:detalhe`) && (() => {
                                  const dcfg = { fonte_row: 0, rows: 3, cols: 2, cells: {}, ...(extra.detail_config || {}) }
                                  const { rows, cols, cells } = dcfg
                                  const eSelKey = selectedDetailCell?.src === extra.id_local
                                    ? `${selectedDetailCell.row},${selectedDetailCell.col}` : null
                                  const setECell = (key, patch) => updateSqlExtra(extra.id_local, 'detail_config', {
                                    ...dcfg, cells: { ...cells, [key]: makeDefaultDetailCell(cells[key] || {}, patch) }
                                  })
                                  const clearECell = (key) => {
                                    const next = { ...cells }; delete next[key]
                                    updateSqlExtra(extra.id_local, 'detail_config', { ...dcfg, cells: next })
                                    setSelectedDetailCell(null)
                                  }
                                  const eCell = eSelKey ? makeDefaultDetailCell(cells[eSelKey] || {}) : null
                                  return (
                                    <div className={`space-y-2 pt-2 border-t ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
                                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Grade do Painel</div>
                                      <div className="flex items-end gap-3 flex-wrap">
                                        <div>
                                          <label className={cls.label}>Origem (linha)</label>
                                          <input type="number" min={0} value={dcfg.fonte_row}
                                            onChange={e => updateSqlExtra(extra.id_local, 'detail_config', { ...dcfg, fonte_row: Number(e.target.value) })}
                                            className={`w-16 rounded border px-2 py-1 text-xs ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                          />
                                        </div>
                                        <div>
                                          <label className={cls.label}>Linhas</label>
                                          <input type="number" min={1} max={12} value={dcfg.rows}
                                            onChange={e => updateSqlExtra(extra.id_local, 'detail_config', { ...dcfg, rows: Number(e.target.value) })}
                                            className={`w-16 rounded border px-2 py-1 text-xs ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                          />
                                        </div>
                                        <div>
                                          <label className={cls.label}>Colunas</label>
                                          <input type="number" min={1} max={6} value={dcfg.cols}
                                            onChange={e => updateSqlExtra(extra.id_local, 'detail_config', { ...dcfg, cols: Number(e.target.value) })}
                                            className={`w-16 rounded border px-2 py-1 text-xs ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                                          />
                                        </div>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: '4px' }}>
                                        {Array.from({ length: rows }, (_, r) =>
                                          Array.from({ length: cols }, (_, c) => {
                                            const key = `${r},${c}`
                                            const cv = cells[key]
                                            const isSel = eSelKey === key
                                            return (
                                              <button key={key} type="button"
                                                onClick={() => setSelectedDetailCell(isSel ? null : { src: extra.id_local, row: r, col: c })}
                                                className={`rounded border p-1.5 text-left min-h-[40px] transition-colors ${
                                                  isSel
                                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                                                    : cv
                                                      ? (dark ? 'border-slate-600 bg-slate-800 hover:border-blue-500/50' : 'border-slate-300 bg-white hover:border-blue-400')
                                                      : (dark ? 'border-slate-700 border-dashed bg-transparent hover:border-slate-500' : 'border-slate-200 border-dashed hover:border-slate-400')
                                                }`}
                                              >
                                                {cv ? (
                                                  cv.tipo === 'texto' ? (
                                                    <span className={`block text-[10px] leading-tight ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{cv.valor || <em className="opacity-40">texto vazio</em>}</span>
                                                  ) : (
                                                    <>
                                                      <span className={`block text-[9px] mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{cv.label || <em>sem label</em>}</span>
                                                      <span className={`block text-[10px] font-medium ${isSel ? 'text-blue-400' : (dark ? 'text-slate-200' : 'text-slate-700')}`}>{cv.coluna || '—'}</span>
                                                    </>
                                                  )
                                                ) : (
                                                  <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-slate-300'}`}>+ clique</span>
                                                )}
                                              </button>
                                            )
                                          })
                                        )}
                                      </div>
                                      {eCell && eSelKey && (
                                        <div className={`rounded border p-2.5 space-y-2 ${dark ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50/60'}`}>
                                          <div className="flex items-center justify-between">
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-blue-400' : 'text-blue-600'}`}>
                                              Célula {selectedDetailCell.row + 1} × {selectedDetailCell.col + 1}
                                            </span>
                                            <button onClick={() => clearECell(eSelKey)} className="text-[10px] text-red-400 hover:text-red-300 hover:underline">Limpar</button>
                                          </div>
                                          <div className="flex gap-4">
                                            {['campo', 'texto'].map(t => (
                                              <label key={t} className="flex items-center gap-1 cursor-pointer text-xs select-none">
                                                <input type="radio" checked={(eCell.tipo || 'campo') === t} onChange={() => setECell(eSelKey, { tipo: t })} />
                                                {t === 'campo' ? 'Campo SQL' : 'Texto livre'}
                                              </label>
                                            ))}
                                          </div>
                                          {(eCell.tipo || 'campo') === 'campo' ? (
                                            <div className="grid grid-cols-3 gap-2">
                                              <div>
                                                <label className={cls.label}>Coluna</label>
                                                <select value={eCell.coluna || ''} onChange={e => setECell(eSelKey, { coluna: e.target.value })} className={cls.select}>
                                                  <option value="">Selecione</option>
                                                  {extraCols.map(col => <option key={col} value={col}>{col}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Label</label>
                                                <input value={eCell.label || ''} onChange={e => setECell(eSelKey, { label: e.target.value })} placeholder="Ex: Total" className={cls.input} />
                                              </div>
                                              <div>
                                                <label className={cls.label}>Formato</label>
                                                <select value={eCell.formato || 'auto'} onChange={e => setECell(eSelKey, { formato: e.target.value })} className={cls.select}>
                                                  {VALUE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Prefixo</label>
                                                <input value={eCell.prefix || ''} onChange={e => setECell(eSelKey, { prefix: e.target.value })} placeholder="Ex: R$" className={cls.input} />
                                              </div>
                                              <div>
                                                <label className={cls.label}>Sufixo</label>
                                                <input value={eCell.suffix || ''} onChange={e => setECell(eSelKey, { suffix: e.target.value })} placeholder="Ex: %" className={cls.input} />
                                              </div>
                                              <div>
                                                <label className={cls.label}>Casas decimais</label>
                                                <input type="number" min={0} max={6} value={eCell.casas_decimais ?? ''} onChange={e => setECell(eSelKey, { casas_decimais: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Auto" className={cls.input} />
                                              </div>
                                              <div>
                                                <label className={cls.label}>Alinhamento</label>
                                                <select value={eCell.alinhamento || 'left'} onChange={e => setECell(eSelKey, { alinhamento: e.target.value })} className={cls.select}>
                                                  {TEXT_ALIGN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Alinhamento vertical</label>
                                                <select value={eCell.alinhamento_vertical || 'top'} onChange={e => setECell(eSelKey, { alinhamento_vertical: e.target.value })} className={cls.select}>
                                                  {VERTICAL_ALIGN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Tamanho do label</label>
                                                <select value={eCell.label_tamanho_fonte || 'xs'} onChange={e => setECell(eSelKey, { label_tamanho_fonte: e.target.value })} className={cls.select}>
                                                  {FONT_SIZE_PRESETS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Label px</label>
                                                <input type="number" min={8} max={72} value={eCell.label_tamanho_fonte_px ?? ''} onChange={e => setECell(eSelKey, { label_tamanho_fonte_px: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Preset" className={cls.input} />
                                              </div>
                                              <div>
                                                <label className={cls.label}>Tamanho do valor</label>
                                                <select value={eCell.valor_tamanho_fonte || 'xl'} onChange={e => setECell(eSelKey, { valor_tamanho_fonte: e.target.value })} className={cls.select}>
                                                  {FONT_SIZE_PRESETS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                              </div>
                                              <div>
                                                <label className={cls.label}>Valor px</label>
                                                <input type="number" min={8} max={120} value={eCell.valor_tamanho_fonte_px ?? ''} onChange={e => setECell(eSelKey, { valor_tamanho_fonte_px: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Preset" className={cls.input} />
                                              </div>
                                            </div>
                                          ) : (
                                            <div>
                                              <label className={cls.label}>Conteúdo</label>
                                              <input value={eCell.valor || ''} onChange={e => setECell(eSelKey, { valor: e.target.value })} placeholder="Texto fixo" className={cls.input} />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            )
                          })}
                          <button onClick={addSqlExtra} className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1`}>
                            <Plus size={12} /> Adicionar SQL
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={cls.section}>
                      <div className={cls.sectionHeader} onClick={() => toggleSection('componentes')}>
                        <span className={cls.sectionTitle}>Componentes e ordem visual</span>
                        {expandedSections.componentes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                      {expandedSections.componentes && (
                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-3">
                          <div>
                            <div className={`${cls.helper} mb-2`}>Arraste para definir a ordem dos blocos da aba SQL.</div>
                            <div className={`rounded-lg border min-h-[140px] p-2 space-y-1 ${dark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'}`}>
                              {(aba.componentes_ordem || []).map((component, index) => (
                                (() => {
                                  const layout = getComponentLayout(component)
                                  return (
                                <div
                                  key={component}
                                  draggable
                                  onDragStart={(event) => event.dataTransfer.setData('text/component', component)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => {
                                    event.preventDefault()
                                    const dragged = getItemFromDrop(event, 'component')
                                    if (!dragged) return
                                    if ((aba.componentes_ordem || []).includes(dragged)) {
                                      moveComponent(dragged, index)
                                    } else {
                                      const instanceId = Math.random().toString(36).slice(2, 8)
                                      const compId = `${dragged}:${instanceId}`
                                      const defaultCfg = getDefaultInstanceConfig(dragged)
                                      updateCurrentAba((current) => {
                                        const next = [...(current.componentes_ordem || [])]
                                        next.splice(index, 0, compId)
                                        return {
                                          ...current,
                                          componentes_ordem: unique(next),
                                          widget_configs: { ...(current.widget_configs || {}), [instanceId]: defaultCfg },
                                          layout_config: { ...(current.layout_config || {}), [compId]: { width: 'full' } },
                                        }
                                      })
                                    }
                                  }}
                                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${dark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'}`}
                                >
                                  <GripVertical size={11} className="opacity-40" />
                                  <span className="flex-1">{getCompLabel(component, aba.widget_configs, aba.sqls_extras, aba.componentes_ordem)}</span>
                                  <select
                                    value={layout.width}
                                    onChange={(event) => setComponentLayout(component, { width: event.target.value })}
                                    className={`rounded-md border px-2 py-1 text-[11px] ${dark ? 'bg-slate-900 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                                    title={`Largura: ${LAYOUT_WIDTH_LABEL[layout.width] || layout.width}`}
                                  >
                                    {LAYOUT_WIDTH_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => removeComponent(component)} className={cls.btnDanger}><Trash2 size={12} /></button>
                                </div>
                                  )
                                })()
                              ))}
                            </div>
                            <div className={`${cls.helper} mt-2`}>No desktop, a largura define quem fica lado a lado. No mobile, todos empilham em 100%.</div>
                          </div>
                          <div>
                            <div className={`${cls.helper} mb-2`}>Biblioteca de componentes</div>
                            <div className="flex flex-wrap gap-2">
                              {inactiveComponents.length > 0 ? inactiveComponents.map((component) => (
                                <button
                                  key={component}
                                  type="button"
                                  draggable
                                  onDragStart={(event) => event.dataTransfer.setData('text/component', component)}
                                  onClick={() => addComponent(component)}
                                  className={`rounded-lg border px-2.5 py-2 text-xs ${dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                                >
                                  {COMPONENT_LABELS[component]}
                                </button>
                              )) : (
                                <div className={cls.dropZone}>Todos os componentes já estão ativos.</div>
                              )}
                            </div>
                            <div className={`mt-3 rounded-lg border p-3 ${dark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <Link2 size={13} className={dark ? 'text-blue-400' : 'text-blue-600'} />
                                <span className={cls.sectionTitle}>Persistência do layout</span>
                              </div>
                              <p className={cls.helper}>Os widgets do dashboard também podem ser arrastados na tela principal. A partir desta implementação, esse layout será salvo por aba no backend.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className={cls.section}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={cls.sectionTitle}>Layout Global</span>
                        <button type="button" onClick={resetLayoutPrefs} className={`${cls.btn} ${cls.btnSecondary}`}>Resetar</button>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <label className={cls.label}>Escala geral</label>
                            <span className={cls.helper}>{Math.round((layoutPrefs?.scale || 1) * 100)}%</span>
                          </div>
                          <input type="range" min="0.8" max="1.8" step="0.05" value={layoutPrefs?.scale || 1} onChange={(event) => updateLayoutPrefs({ scale: Number(event.target.value) })} className="w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={cls.label}>Gap entre widgets</label>
                            <input type="number" min={4} max={24} value={layoutPrefs?.widgetGap || 8} onChange={(event) => updateLayoutPrefs({ widgetGap: Number(event.target.value) })} className={cls.input} />
                          </div>
                          <div>
                            <label className={cls.label}>Padding interno</label>
                            <input type="number" min={4} max={24} value={layoutPrefs?.widgetPadding || 8} onChange={(event) => updateLayoutPrefs({ widgetPadding: Number(event.target.value) })} className={cls.input} />
                          </div>
                          <div>
                            <label className={cls.label}>Largura mínima do campo</label>
                            <input type="number" min={100} max={420} value={layoutPrefs?.fieldMinWidth || 160} onChange={(event) => updateLayoutPrefs({ fieldMinWidth: Number(event.target.value) })} className={cls.input} />
                          </div>
                          <div>
                            <label className={cls.label}>Máx. colunas detalhe fullscreen</label>
                            <input type="number" min={1} max={8} value={layoutPrefs?.detailMaxColsFullscreen || 4} onChange={(event) => updateLayoutPrefs({ detailMaxColsFullscreen: Number(event.target.value) })} className={cls.input} />
                          </div>
                        </div>
                        <div>
                          <div className={`${cls.helper} mb-2`}>Altura dos widgets</div>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ['detalhe', 'Painel de Detalhe'],
                              ['campo', 'Campo'],
                              ['kpis', 'KPIs'],
                              ['tabela', 'Tabela'],
                              ['pivot', 'Pivot'],
                              ['grafico', 'Gráfico'],
                            ].map(([key, label]) => (
                              <div key={key}>
                                <label className={cls.label}>{label}</label>
                                <input
                                  type="number"
                                  min={100}
                                  max={900}
                                  value={layoutPrefs?.widgetHeights?.[key] || ''}
                                  onChange={(event) => updateLayoutPrefs((prev) => ({ ...prev, widgetHeights: { ...(prev.widgetHeights || {}), [key]: Number(event.target.value) } }))}
                                  className={cls.input}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className={cls.helper}>Essas opções são globais do Raio-X e aplicam imediatamente no layout, fullscreen e widgets configuráveis.</div>
                      </div>
                    </div>

                    <div className={`${cls.section} sticky top-0`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={cls.sectionTitle}>Resumo da aba</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{availableColumns.length} coluna(s)</span>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div>
                          <div className={`${cls.helper} mb-1`}>Tabela</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(aba.colunas_visiveis || []).length > 0 ? (aba.colunas_visiveis || []).map((column) => (
                              <span key={column} className={`rounded-full px-2 py-1 ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>{column}</span>
                            )) : <span className={cls.helper}>Sem colunas selecionadas</span>}
                          </div>
                        </div>
                        <div>
                          <div className={`${cls.helper} mb-1`}>KPIs</div>
                          <div className="space-y-1">
                            {(aba.kpis_config || []).length > 0 ? (aba.kpis_config || []).map((kpi, index) => (
                              <div key={`summary-kpi-${index}`} className={`rounded-lg px-2 py-1.5 ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                                <strong>{kpi.label || 'Sem label'}</strong>
                                <div className={cls.helper}>{kpi.agregacao || 'count'} em {kpi.coluna || 'sem coluna'}</div>
                              </div>
                            )) : <span className={cls.helper}>Nenhum KPI configurado</span>}
                          </div>
                        </div>
                        <div>
                          <div className={`${cls.helper} mb-1`}>Gráfico</div>
                          <div className={`rounded-lg px-2 py-1.5 ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                            <div>Tipo: {aba.grafico_config?.tipo || 'bar'}</div>
                            <div className={cls.helper}>X: {aba.grafico_config?.label_col || 'não definido'} | Valor: {aba.grafico_config?.value_col || 'não definido'}</div>
                          </div>
                        </div>
                        <div>
                          <div className={`${cls.helper} mb-1`}>Ordem visual</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(aba.componentes_ordem || []).map((component) => (
                              <span key={`summary-${component}`} className={`rounded-full px-2 py-1 ${dark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{getCompLabel(component, aba.widget_configs, aba.sqls_extras)}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {aba.tipo === 'dados_pedido' && (
                <div className={cls.section}>
                  <div className={cls.sectionTitle}>Dados do Pedido</div>
                  <p className={`${cls.helper} mt-2`}>Essa aba sempre usa os dados já importados do pedido atual. Não há configuração adicional além do nome e da ordem.</p>
                </div>
              )}

              {aba.tipo === 'texto' && (
                <div>
                  <label className={cls.label}>Conteúdo do Texto</label>
                  <textarea
                    value={aba.texto || ''}
                    onChange={(event) => update('texto', event.target.value)}
                    className={`${cls.input} h-48 resize-y`}
                    placeholder="Digite o texto..."
                  />
                </div>
              )}
            </div>
          )}

          <div className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
            {saveError && (
              <span className="flex-1 text-xs text-red-400 mr-2">{saveError}</span>
            )}
            <button onClick={() => setOpen(false)} className={`${cls.btn} ${cls.btnSecondary} flex items-center gap-1`}>
              <RotateCcw size={12} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className={`${cls.btn} ${cls.btnPrimary} flex items-center gap-1`}>
              <Save size={12} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
