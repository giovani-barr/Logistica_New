import { useMemo } from 'react'
import { useRaioX } from '../context/RaioXContext'
import DashboardGrid from './DashboardGrid'
import DadosPedido from './widgets/DadosPedido'
import TextWidget from './widgets/TextWidget'
import { Loader2 } from 'lucide-react'

export default function AbaContent() {
  const { abas, abaAtiva, cache, theme, loading } = useRaioX()
  const aba = abas.find(a => a.id === abaAtiva)
  const dark = theme === 'dark'

  // Extrai entradas de cache correspondentes aos sql_extras desta aba
  const extraCache = useMemo(() => {
    if (!aba?.id) return {}
    const prefix = `${aba.id}::`
    const result = {}
    Object.keys(cache).forEach(key => {
      if (key.startsWith(prefix)) result[key] = cache[key]
    })
    return result
  }, [aba?.id, cache])

  if (!aba) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Nenhuma aba selecionada.
      </div>
    )
  }

  if (aba.tipo === 'dados_pedido') return <DadosPedido />
  if (aba.tipo === 'texto') return <TextWidget aba={aba} />

  if (!aba.sql_extra_id && !(aba.sqls_extras || []).length) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        ⚠️ Aba sem SQL configurado. Abra <strong className="mx-1">⚙ Config</strong> para configurar.
      </div>
    )
  }

  const cached = cache[aba.id] || (aba.sql_extra_id ? null : { data: [], cols: [] })

  // Sem dados ainda (SQL principal pendente): mostrar spinner
  if (!cached && aba.sql_extra_id) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center gap-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        <Loader2 size={28} className="animate-spin opacity-60" />
        <span className="text-sm">Carregando dados...</span>
      </div>
    )
  }

  if (cached.error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500 text-sm p-4">
        ❌ {cached.error}
      </div>
    )
  }

  // Dados carregados — exibe o dashboard (o ícone ↺ no header gira quando loading=true durante reload)
  return <DashboardGrid aba={aba} data={cached.data} extraCache={extraCache} />
}
