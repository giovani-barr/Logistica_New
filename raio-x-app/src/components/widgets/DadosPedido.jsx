import { useRaioX } from '../../context/RaioXContext'

export default function DadosPedido() {
  const { pedido, theme } = useRaioX()
  const dark = theme === 'dark'
  const pd = pedido.pedidoData

  if (!pd) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Nenhum dado disponível.</div>

  const items = []
  const diretos = { 'Nº Pedido': pd.numero_pedido, 'Cliente': pd.cliente_nome, 'Endereço': pd.endereco, 'Telefone': pd.telefone, 'Email': pd.email, 'Entregador': pd.entregador }
  for (const [k, v] of Object.entries(diretos)) { if (v) items.push({ label: k, valor: v }) }
  const dados = pd.dados_json || {}
  for (const [k, v] of Object.entries(dados)) {
    if (['id', 'latitude', 'longitude'].includes(k.toLowerCase())) continue
    items.push({ label: k, valor: v != null ? String(v) : '—' })
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">📋 Dados Importados</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {items.map((it, i) => (
          <div key={i} className={`rounded-lg p-2.5 ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{it.label}</div>
            <div className="text-sm font-medium truncate">{it.valor || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
