import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { fetchAbas as apiFetchAbas, fetchSqls as apiFetchSqls, executeAba as apiExecuteAba, saveAbas as apiSaveAbas } from '../api/raioXApi'

const RaioXContext = createContext(null)
const LAYOUT_PREFS_KEY = 'rx-layout-prefs'
const DEFAULT_LAYOUT_PREFS = {
  scale: 1,
  widgetGap: 8,
  widgetPadding: 8,
  fieldMinWidth: 160,
  detailMaxColsFullscreen: 4,
  widgetHeights: {
    kpis: 140,
    tabela: 420,
    grafico: 320,
    pivot: 420,
    campo: 120,
    detalhe: 300,
  },
}

function normalizeLayoutPrefs(prefs) {
  const safe = prefs || {}
  return {
    scale: Number.isFinite(Number(safe.scale)) ? Math.min(1.8, Math.max(0.8, Number(safe.scale))) : DEFAULT_LAYOUT_PREFS.scale,
    widgetGap: Number.isFinite(Number(safe.widgetGap)) ? Math.min(24, Math.max(4, Number(safe.widgetGap))) : DEFAULT_LAYOUT_PREFS.widgetGap,
    widgetPadding: Number.isFinite(Number(safe.widgetPadding)) ? Math.min(24, Math.max(4, Number(safe.widgetPadding))) : DEFAULT_LAYOUT_PREFS.widgetPadding,
    fieldMinWidth: Number.isFinite(Number(safe.fieldMinWidth)) ? Math.min(420, Math.max(100, Number(safe.fieldMinWidth))) : DEFAULT_LAYOUT_PREFS.fieldMinWidth,
    detailMaxColsFullscreen: Number.isFinite(Number(safe.detailMaxColsFullscreen)) ? Math.min(8, Math.max(1, Number(safe.detailMaxColsFullscreen))) : DEFAULT_LAYOUT_PREFS.detailMaxColsFullscreen,
    widgetHeights: {
      ...DEFAULT_LAYOUT_PREFS.widgetHeights,
      ...(safe.widgetHeights || {}),
    },
  }
}

function normalizeAba(aba) {
  return {
    ...aba,
    campos_join: aba.campos_join || [],
    kpis_config: aba.kpis_config || [],
    colunas_visiveis: aba.colunas_visiveis || [],
    grafico_config: aba.grafico_config
      ? { series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, ...aba.grafico_config }
      : { tipo: 'bar', label_col: '', series: [], format: 'auto', stacked: false, show_legend: true, show_data_labels: false, visivel: true },
    pivot_config: aba.pivot_config || {},
    widget_configs: aba.widget_configs || {},
    sqls_extras: aba.sqls_extras || [],
    detail_config: aba.detail_config || {},
    componentes_ordem: aba.componentes_ordem || ['kpis', 'tabela', 'grafico', 'pivot', 'detalhe'],
    layout_config: aba.layout_config || {},
    texto: aba.texto || '',
  }
}

export function useRaioX() {
  const ctx = useContext(RaioXContext)
  if (!ctx) throw new Error('useRaioX must be inside RaioXProvider')
  return ctx
}

export function RaioXProvider({ pedido, onClose, children }) {
  const [abas, setAbas] = useState([])
  const [abaAtiva, setAbaAtiva] = useState(null)
  const [cache, setCache] = useState({})
  const [sqls, setSqls] = useState([])
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('rx-theme') || 'light')
  const [layoutPrefs, setLayoutPrefs] = useState(() => {
    try {
      return normalizeLayoutPrefs(JSON.parse(localStorage.getItem(LAYOUT_PREFS_KEY) || 'null'))
    } catch {
      return DEFAULT_LAYOUT_PREFS
    }
  })
  const [fullscreenWidget, setFullscreenWidget] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const abasRef = useRef(abas)
  abasRef.current = abas
  const cacheRef = useRef(cache)
  cacheRef.current = cache
  const executingRef = useRef(false) // previne execução dupla

  const pedidoFields = useMemo(() => {
    if (!pedido.pedidoData) return []
    const fields = []
    const diretos = ['numero_pedido', 'cliente_nome', 'endereco', 'telefone', 'email', 'entregador']
    diretos.forEach((field) => {
      if (pedido.pedidoData[field]) fields.push(field)
    })

    const dados = pedido.pedidoData.dados_json || {}
    Object.keys(dados).forEach((field) => {
      if (!['id', 'latitude', 'longitude'].includes(field.toLowerCase())) fields.push(field)
    })

    return [...new Set(fields)]
  }, [pedido.pedidoData])

  useEffect(() => {
    localStorage.setItem('rx-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify(layoutPrefs))
  }, [layoutPrefs])

  const loadAbas = useCallback(async (preferredAbaId = null) => {
    const json = await apiFetchAbas()
    if (json.success) {
      const nextAbas = (json.abas || []).map(normalizeAba)
      setAbas(nextAbas)
      setAbaAtiva((current) => {
        if (preferredAbaId && nextAbas.some((aba) => aba.id === preferredAbaId)) return preferredAbaId
        if (current && nextAbas.some((aba) => aba.id === current)) return current
        return nextAbas[0]?.id ?? null
      })
      return nextAbas
    }
    return []
  }, [])

  const loadSqls = useCallback(async () => {
    const json = await apiFetchSqls()
    if (json.success) setSqls(json.sqls || [])
  }, [])

  useEffect(() => { loadAbas() }, [loadAbas])

  const execute = useCallback(async (aba, camposJoin) => {
    if (!aba?.sql_extra_id) return null
    executingRef.current = true
    setLoading(true)
    try {
      const json = await apiExecuteAba({
        sqlExtraId: aba.sql_extra_id,
        pedidoId: pedido.pedidoId,
        numeroPedido: pedido.numeroPedido,
        camposJoin,
      })
      if (json.success) {
        const entry = { cols: json.columns || [], data: json.data || [], message: json.message, filtered_by: json.filtered_by }
        if (aba.id != null) setCache(prev => ({ ...prev, [aba.id]: entry }))
        return entry
      }
      // Armazena o erro no cache também — evita spinner infinito no AbaContent
      const errorEntry = { error: json.message || 'Erro desconhecido', cols: [], data: [] }
      if (aba.id != null) setCache(prev => ({ ...prev, [aba.id]: errorEntry }))
      return errorEntry
    } catch (e) {
      const errorEntry = { error: e.message, cols: [], data: [] }
      if (aba.id != null) setCache(prev => ({ ...prev, [aba.id]: errorEntry }))
      return errorEntry
    } finally {
      setLoading(false)
      executingRef.current = false
    }
  }, [pedido])

  // Executa os SQLs extras de uma aba (sqls_extras[])
  const executeExtraSqls = useCallback(async (aba) => {
    const extras = aba.sqls_extras || []
    if (!extras.length) return
    for (const extra of extras) {
      if (!extra.sql_extra_id || !extra.id_local) continue
      const cacheKey = `${aba.id}::${extra.id_local}`
      try {
        const json = await apiExecuteAba({
          sqlExtraId: extra.sql_extra_id,
          pedidoId: pedido.pedidoId,
          numeroPedido: pedido.numeroPedido,
          camposJoin: extra.campos_join || [],
        })
        if (json.success) {
          const entry = { cols: json.columns || [], data: json.data || [], message: json.message }
          setCache(prev => ({ ...prev, [cacheKey]: entry }))
        } else {
          setCache(prev => ({ ...prev, [cacheKey]: { error: json.message || 'Erro', cols: [], data: [] } }))
        }
      } catch (e) {
        setCache(prev => ({ ...prev, [cacheKey]: { error: e.message, cols: [], data: [] } }))
      }
    }
  }, [pedido])

  // Executa o SQL principal + todos os extras de uma aba
  const executeAllForAba = useCallback(async (aba) => {
    const promises = []
    if (aba.sql_extra_id) {
      promises.push(execute(aba, aba.campos_join || []))
    }
    if ((aba.sqls_extras || []).length) {
      promises.push(executeExtraSqls(aba))
    }
    await Promise.all(promises)
  }, [execute, executeExtraSqls])

  const loadColumnsForAba = useCallback(async (aba) => {
    if (!aba?.sql_extra_id) return []
    // Só usa cache se a aba já tem id persistido
    if (aba.id != null) {
      const cached = cacheRef.current[aba.id]?.cols
      if (cached?.length) return cached
    }
    const result = await execute(aba, aba.campos_join || [])
    if (result?.error) return []
    return result?.cols || []
  }, [execute])

  const persistAbas = useCallback(async (nextAbas, options = {}) => {
    const { reload = false, clearCache = false, preferredAbaId = null } = options
    const normalized = nextAbas.map(normalizeAba)
    const json = await apiSaveAbas(normalized)
    if (!json.success) return json

    if (clearCache) setCache({})

    if (reload) {
      await loadAbas(preferredAbaId)
    } else {
      setAbas(normalized)
      if (preferredAbaId) setAbaAtiva(preferredAbaId)
    }

    return json
  }, [loadAbas])

  const saveConfig = useCallback(async (newAbas, activeEditIdx = null) => {
    // 1. Salva no backend
    const normalized = newAbas.map(normalizeAba)
    console.log('[raio-x] saveConfig: enviando', normalized.length, 'abas para o backend')
    let json
    try {
      json = await apiSaveAbas(normalized)
    } catch (e) {
      console.error('[raio-x] saveConfig: exceção no apiSaveAbas=', e)
      return { success: false, message: `Erro de rede: ${e?.message || 'sem resposta do servidor'}` }
    }
    console.log('[raio-x] saveConfig: resposta do backend=', JSON.stringify(json))
    if (!json.success) return json

    // 2. Limpa cache e recarrega abas com IDs reais do banco
    setCache({})
    const freshAbas = await loadAbas(abaAtiva)

    // 3. Navega para a aba que o usuário estava editando no modal
    let targetAba = null
    if (activeEditIdx != null && freshAbas[activeEditIdx]) {
      targetAba = freshAbas[activeEditIdx]
      setAbaAtiva(targetAba.id)
    } else {
      targetAba = freshAbas.find((a) => a.id === abaAtiva) || freshAbas[0]
    }

    // 4. Auto-executa se for aba SQL com SQL configurado
    if (targetAba?.tipo === 'sql' && (targetAba?.sql_extra_id || (targetAba?.sqls_extras || []).length)) {
      await executeAllForAba(targetAba)
    }

    return json
  }, [abaAtiva, loadAbas, executeAllForAba])

  const saveAbaLayout = useCallback(async (abaId, layoutConfig) => {
    const nextAbas = abasRef.current.map((aba) => (
      aba.id === abaId ? normalizeAba({ ...aba, layout_config: layoutConfig }) : aba
    ))
    setAbas(nextAbas)
    const json = await apiSaveAbas(nextAbas)
    if (!json.success) await loadAbas(abaId)
    return json
  }, [loadAbas])

  const toggleTheme = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), [])
  const updateLayoutPrefs = useCallback((patch) => {
    setLayoutPrefs((prev) => normalizeLayoutPrefs(typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
  }, [])
  const resetLayoutPrefs = useCallback(() => setLayoutPrefs(DEFAULT_LAYOUT_PREFS), [])

  // Auto-executar SQL ao carregar abas ou trocar de aba
  // Depende de [abas] além de [abaAtiva] para disparar quando loadAbas popula a lista pela 1a vez
  useEffect(() => {
    if (!abaAtiva || !abas.length) return
    const aba = abas.find(a => a.id === abaAtiva)
    if (!aba || aba.tipo !== 'sql') return
    if (!aba.sql_extra_id && !(aba.sqls_extras || []).length) return
    if (executingRef.current) return  // já está executando

    const temCachePrimario = !!cacheRef.current[abaAtiva]

    // Verifica quais sqls_extras ainda não têm cache
    const extrasSemCache = (aba.sqls_extras || []).filter(e =>
      e.sql_extra_id && e.id_local && !cacheRef.current[`${abaAtiva}::${e.id_local}`]
    )

    if (temCachePrimario && extrasSemCache.length === 0) return  // tudo em cache, nada a fazer

    if (!temCachePrimario) {
      // Executa tudo (principal + extras)
      executeAllForAba(aba)
    } else {
      // Só executa os extras que faltam
      executeExtraSqls(aba)
    }
  }, [abaAtiva, abas, executeAllForAba, executeExtraSqls])

  const reloadAba = useCallback(async (abaId) => {
    const aba = abasRef.current.find(a => a.id === abaId)
    if (!aba) return
    // Limpa cache do principal + todos os extras
    setCache(prev => {
      const next = { ...prev }
      delete next[abaId]
      ;(aba.sqls_extras || []).forEach(e => { if (e.id_local) delete next[`${abaId}::${e.id_local}`] })
      return next
    })
    await executeAllForAba(aba)
  }, [executeAllForAba])

  // Atualiza campo de uma aba localmente + salva no backend (sem reload completo)
  const updateAbaInline = useCallback(async (abaId, patch) => {
    const nextAbas = abasRef.current.map(aba =>
      aba.id === abaId ? normalizeAba({ ...aba, ...patch }) : aba
    )
    setAbas(nextAbas)
    await apiSaveAbas(nextAbas)
  }, [])

  // Carrega colunas de um SQL extra (para uso no ConfigModal)
  const loadColumnsForExtra = useCallback(async (aba, idLocal) => {
    const extra = (aba.sqls_extras || []).find(e => e.id_local === idLocal)
    if (!extra?.sql_extra_id) return []
    const cacheKey = `${aba.id}::${idLocal}`
    const cached = cacheRef.current[cacheKey]?.cols
    if (cached?.length) return cached
    try {
      const json = await apiExecuteAba({
        sqlExtraId: extra.sql_extra_id,
        pedidoId: pedido.pedidoId,
        numeroPedido: pedido.numeroPedido,
        camposJoin: extra.campos_join || [],
      })
      if (json.success) {
        const entry = { cols: json.columns || [], data: json.data || [] }
        setCache(prev => ({ ...prev, [cacheKey]: entry }))
        return json.columns || []
      }
    } catch (_) {}
    return []
  }, [pedido])

  const value = {
    pedido, onClose, abas, setAbas, abaAtiva, setAbaAtiva, cache, setCache,
    sqls, setSqls, loading, setLoading, theme, toggleTheme,
    fullscreenWidget, setFullscreenWidget, sidebarOpen, setSidebarOpen,
    isFullscreen, setIsFullscreen,
    layoutPrefs, updateLayoutPrefs, resetLayoutPrefs,
    pedidoFields,
    loadAbas, loadSqls, execute, executeAllForAba, executeExtraSqls,
    loadColumnsForAba, loadColumnsForExtra,
    updateAbaInline,
    saveConfig, saveAbaLayout, persistAbas, reloadAba,
  }

  return <RaioXContext.Provider value={value}>{children}</RaioXContext.Provider>
}
