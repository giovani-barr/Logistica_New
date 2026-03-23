import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X, Check } from 'lucide-react'
import { useRaioX } from '../../context/RaioXContext'
import {
  FONT_SIZE_PRESETS,
  TEXT_ALIGN_OPTIONS,
  VALUE_TYPE_OPTIONS,
  VERTICAL_ALIGN_OPTIONS,
  formatValue,
  resolveFontSize,
  toNumber,
} from '../../utils/valueFormatting'

const AGREGACOES = [
  { value: 'first',  label: 'Primeiro valor' },
  { value: 'last',   label: 'Último valor' },
  { value: 'count',  label: 'Contagem' },
  { value: 'sum',    label: 'Soma' },
  { value: 'avg',    label: 'Média' },
  { value: 'max',    label: 'Máximo' },
  { value: 'min',    label: 'Mínimo' },
  { value: 'unique', label: 'Qtd únicos' },
  { value: 'concat', label: 'Lista (únicos)' },
]

function computeValue(data, coluna, agregacao) {
  if (!data?.length || !coluna) return '—'
  const rawVals = data.map(r => r[coluna])
  const nums = rawVals.map(v => toNumber(v)).filter(v => v != null)
  switch (agregacao) {
    case 'count':  return data.length
    case 'sum':    return nums.length ? +nums.reduce((a, b) => a + b, 0).toFixed(4) : '—'
    case 'avg':    return nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '—'
    case 'max':    return nums.length ? Math.max(...nums) : '—'
    case 'min':    return nums.length ? Math.min(...nums) : '—'
    case 'first':  return rawVals.find(v => v != null) ?? '—'
    case 'last': {
      const nonNull = rawVals.filter(v => v != null)
      return nonNull.length ? nonNull[nonNull.length - 1] : '—'
    }
    case 'unique': return new Set(rawVals.filter(v => v != null)).size
    case 'concat': {
      const uniq = [...new Set(rawVals.filter(v => v != null).map(String))]
      return uniq.slice(0, 8).join(', ') + (uniq.length > 8 ? ` … +${uniq.length - 8}` : '')
    }
    default: return '—'
  }
}

export default function FieldWidget({ widgetId, config, data, columns, onUpdate, expanded = false }) {
  const { theme, layoutPrefs } = useRaioX()
  const dark = theme === 'dark'
  const scale = layoutPrefs?.scale || 1
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [panelStyle, setPanelStyle] = useState(null)
  const panelRef = useRef(null)
  const widgetRef = useRef(null)

  const coluna   = config?.coluna    || columns[0] || ''
  const agregacao= config?.agregacao || 'first'
  const label    = config?.label     || coluna
  const estilo   = config?.estilo    || {}

  const tamanhoFonte= estilo.tamanho_fonte || '2xl'
  const tamanhoFonteCustom = estilo.tamanho_fonte_px || ''
  const corValor    = estilo.cor_valor     || (dark ? '#e2e8f0' : '#0f172a')
  const corFundo    = estilo.cor_fundo     || (dark ? '#1e293b' : '#ffffff')
  const corBorda    = estilo.cor_borda     || (dark ? '#334155' : '#e2e8f0')
  const icone       = estilo.icone         || ''
  const tipoValor   = estilo.tipo_valor    || 'auto'
  const alinhamento = estilo.alinhamento   || 'left'
  const alinhamentoVertical = estilo.alinhamento_vertical || 'top'
  const casasDecimais = estilo.casas_decimais
  const prefixo = estilo.prefixo || ''
  const sufixo = estilo.sufixo || ''

  const value = computeValue(data, coluna, agregacao)
  const displayValue = formatValue(value, tipoValor, { decimals: casasDecimais, prefix: prefixo, suffix: sufixo })

  const openEdit = useCallback((e) => {
    e.stopPropagation()
    setDraft({ coluna, agregacao, label: config?.label || '', estilo: { ...estilo } })
    setEditOpen(true)
  }, [coluna, agregacao, config?.label, estilo])

  const closeEdit = useCallback(() => setEditOpen(false), [])

  const saveEdit = useCallback(() => {
    if (draft) onUpdate(widgetId, draft)
    setEditOpen(false)
  }, [draft, onUpdate, widgetId])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!editOpen) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && widgetRef.current && !widgetRef.current.contains(e.target)) closeEdit()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editOpen, closeEdit])

  useLayoutEffect(() => {
    if (!editOpen) return

    const updatePosition = () => {
      if (!widgetRef.current) return
      const rect = widgetRef.current.getBoundingClientRect()
      const panelWidth = 360
      const panelHeight = panelRef.current?.offsetHeight || 520
      const margin = 12

      let left = rect.left
      let top = rect.top

      if (left + panelWidth > window.innerWidth - margin) {
        left = window.innerWidth - panelWidth - margin
      }
      if (left < margin) left = margin

      if (top + panelHeight > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - panelHeight - margin)
      }
      if (top < margin) top = margin

      setPanelStyle({ left: `${left}px`, top: `${top}px` })
    }

    const raf = requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [editOpen])

  const setDraftField = (field, val) =>
    setDraft(prev => ({ ...prev, [field]: val }))

  const setEstiloField = (field, val) =>
    setDraft(prev => ({ ...prev, estilo: { ...(prev?.estilo || {}), [field]: val } }))

  const fontSizePx = Math.round(resolveFontSize(tamanhoFonte, tamanhoFonteCustom, expanded) * scale)
  const justifyContent = alinhamentoVertical === 'bottom' ? 'flex-end' : alinhamentoVertical === 'middle' ? 'center' : 'flex-start'
  const alignItems = alinhamento === 'right' ? 'flex-end' : alinhamento === 'center' ? 'center' : 'flex-start'
  const cardPadding = Math.round((expanded ? 16 : 12) * scale)
  const minHeight = Math.round((expanded ? 140 : 100) * scale)

  return (
    <div
      ref={widgetRef}
      className="relative group rounded-xl border flex flex-col select-none"
      style={{ background: corFundo, borderColor: corBorda, padding: `${cardPadding}px`, minHeight: `${minHeight}px` }}
    >
      {/* Botão editar (aparece no hover) */}
      <button
        onClick={openEdit}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-white/20 hover:bg-white/40"
        title="Editar widget"
      >
        <Pencil size={12} className={dark ? 'text-slate-300' : 'text-slate-600'} />
      </button>

      {/* Conteúdo do card */}
      <div className="flex-1 flex min-h-0" style={{ justifyContent, alignItems }}>
        <div className="w-full" style={{ textAlign: alinhamento }}>
          <div className={`${expanded ? 'text-xs' : 'text-[11px]'} font-medium opacity-60 uppercase tracking-wider truncate`} style={{ color: corValor }}>
            {icone && <span className="mr-1">{icone}</span>}
            {label}
          </div>
          <div className="font-bold leading-tight mt-1 break-words" style={{ color: corValor, fontSize: `${fontSizePx}px` }}>
            {displayValue}
          </div>
        </div>
      </div>

      {/* Painel de edição inline */}
      {editOpen && draft && createPortal((
        <div
          ref={panelRef}
          className={`fixed z-[10020] w-[360px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-auto rounded-xl border shadow-2xl p-3 space-y-2.5 ${
            dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
          }`}
          style={{ minWidth: 320, ...panelStyle }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>Editar widget</span>
            <button onClick={closeEdit} className="p-1 rounded hover:bg-slate-200/30"><X size={13} /></button>
          </div>

          {/* Coluna */}
          <div>
            <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Coluna</label>
            <select
              value={draft.coluna || ''}
              onChange={e => setDraftField('coluna', e.target.value)}
              className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              {(columns || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Agregação */}
          <div>
            <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Agregação</label>
            <select
              value={draft.agregacao || 'first'}
              onChange={e => setDraftField('agregacao', e.target.value)}
              className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              {AGREGACOES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {/* Label + ícone */}
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Label</label>
              <input
                value={draft.label || ''}
                onChange={e => setDraftField('label', e.target.value)}
                placeholder={draft.coluna || ''}
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Ícone</label>
              <input
                value={draft.estilo?.icone || ''}
                onChange={e => setEstiloField('icone', e.target.value)}
                placeholder="🔢"
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Tipo do valor</label>
              <select
                value={draft.estilo?.tipo_valor || 'auto'}
                onChange={e => setEstiloField('tipo_valor', e.target.value)}
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                {VALUE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Casas decimais</label>
              <input
                type="number"
                min={0}
                max={6}
                value={draft.estilo?.casas_decimais ?? ''}
                onChange={e => setEstiloField('casas_decimais', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Auto"
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </div>
          </div>

          {/* Tamanho da fonte */}
          <div>
            <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Tamanho da fonte</label>
            <div className="flex gap-1">
              {FONT_SIZE_PRESETS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setEstiloField('tamanho_fonte', f.value)}
                  className={`flex-1 py-1 rounded text-xs border transition-colors ${
                    (draft.estilo?.tamanho_fonte || '2xl') === f.value
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : (dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={8}
              max={120}
              value={draft.estilo?.tamanho_fonte_px ?? ''}
              onChange={e => setEstiloField('tamanho_fonte_px', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Tamanho custom em px"
              className={`w-full mt-2 text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Alinhamento</label>
              <select
                value={draft.estilo?.alinhamento || 'left'}
                onChange={e => setEstiloField('alinhamento', e.target.value)}
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                {TEXT_ALIGN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Alinhamento vertical</label>
              <select
                value={draft.estilo?.alinhamento_vertical || 'top'}
                onChange={e => setEstiloField('alinhamento_vertical', e.target.value)}
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                {VERTICAL_ALIGN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Prefixo</label>
              <input
                value={draft.estilo?.prefixo || ''}
                onChange={e => setEstiloField('prefixo', e.target.value)}
                placeholder="Ex: R$"
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Sufixo</label>
              <input
                value={draft.estilo?.sufixo || ''}
                onChange={e => setEstiloField('sufixo', e.target.value)}
                placeholder="Ex: %"
                className={`w-full text-xs rounded border px-2 py-1.5 ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
              />
            </div>
          </div>

          {/* Cores */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { field: 'cor_valor', label: 'Texto' },
              { field: 'cor_fundo', label: 'Fundo' },
              { field: 'cor_borda', label: 'Borda' },
            ].map(({ field, label: lbl }) => (
              <div key={field}>
                <label className={`block text-[10px] font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{lbl}</label>
                <input
                  type="color"
                  value={draft.estilo?.[field] || '#ffffff'}
                  onChange={e => setEstiloField(field, e.target.value)}
                  className="w-full h-8 rounded border cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveEdit}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600"
            >
              <Check size={12} /> Salvar
            </button>
            <button
              onClick={closeEdit}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Cancelar
            </button>
          </div>
        </div>
      ), document.body)}
    </div>
  )
}
