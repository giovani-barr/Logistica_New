import { useState } from 'react'
import { useRaioX } from '../context/RaioXContext'
import { Play, Loader2 } from 'lucide-react'

export default function Sidebar() {
  const { abas, abaAtiva, pedido, sidebarOpen, loading, execute, theme } = useRaioX()
  const aba = abas.find(a => a.id === abaAtiva)
  const dark = theme === 'dark'
  const [execInfo, setExecInfo] = useState(null)

  const mappedParams = (aba?.campos_join || []).filter(p => p.campo_pedido)

  const handleExecute = async () => {
    if (!aba) return
    setExecInfo(null)
    const result = await execute(aba, aba.campos_join || [])
    if (result?.error) setExecInfo({ type: 'error', text: result.error })
    else if (result) setExecInfo({ type: 'success', text: result.message, filtered: result.filtered_by })
  }

  if (!sidebarOpen) return null

  return (
    <div className={`w-[200px] min-w-[200px] flex flex-col gap-2 p-3 border-r overflow-y-auto shrink-0 transition-all ${
      dark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
    }`}>
      {aba?.tipo === 'dados_pedido' && (
        <p className="text-xs text-slate-500">Exibe os dados básicos do pedido importado.</p>
      )}
      {aba?.tipo === 'texto' && (
        <p className="text-xs text-slate-500">Aba de texto livre.</p>
      )}
      {aba?.tipo === 'sql' && (
        <>
          {!aba.sql_extra_id ? (
            <p className="text-xs text-amber-600">⚠️ Configure o SQL em ⚙ Config.</p>
          ) : (
            <>
              {mappedParams.length > 0 && (
                <div className={`rounded-lg p-2 ${dark ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-blue-600'}`}>
                    🔗 Filtros configurados
                  </div>
                  {mappedParams.map(p => (
                    <div key={p.coluna_sql} className={`text-[11px] flex items-center gap-1 mb-0.5 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <span className={`font-mono ${dark ? 'text-blue-400' : 'text-blue-600'}`}>:{p.coluna_sql}</span>
                      <span className="text-slate-400">←</span>
                      <span className="truncate">{p.campo_pedido}</span>
                    </div>
                  ))}
                  <div className={`text-[10px] mt-1.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Para alterar, abra ⚙ Config
                  </div>
                </div>
              )}
              {mappedParams.length === 0 && (
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  SQL sem filtros por pedido. Configure em ⚙ Config se necessário.
                </p>
              )}
              <button
                onClick={handleExecute}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {loading ? 'Executando...' : 'Executar'}
              </button>
              {execInfo && (
                <div className={`text-xs rounded-md p-2 ${
                  execInfo.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {execInfo.type === 'success' ? '✅ ' : '❌ '}{execInfo.text}
                  {execInfo.filtered && <div className="mt-1 text-[11px] opacity-80">🔗 {execInfo.filtered}</div>}
                </div>
              )}
            </>
          )}
        </>
      )}
      <div className="flex-1" />
      {(pedido.numeroPedido || pedido.clienteNome) && (
        <div className={`text-xs rounded-md p-2 ${dark ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
          {pedido.numeroPedido && <div><strong>Pedido:</strong> #{pedido.numeroPedido}</div>}
          {pedido.clienteNome && <div><strong>Cliente:</strong> {pedido.clienteNome}</div>}
        </div>
      )}
    </div>
  )
}
