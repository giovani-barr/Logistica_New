import { useRaioX } from '../../context/RaioXContext'

export default function TextWidget({ aba }) {
  const { theme } = useRaioX()
  const dark = theme === 'dark'

  if (!aba.texto) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Sem texto configurado. Abra <strong className="mx-1">⚙ Config</strong> para editar.</div>
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">📝 {aba.nome}</h3>
      <div className={`whitespace-pre-wrap text-sm leading-relaxed p-4 rounded-lg ${dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
        {aba.texto}
      </div>
    </div>
  )
}
