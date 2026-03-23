import { useRaioX } from '../context/RaioXContext'

export default function TabBar() {
  const { abas, abaAtiva, setAbaAtiva, theme } = useRaioX()
  const dark = theme === 'dark'

  return (
    <div className={`flex items-stretch gap-0.5 px-3 overflow-x-auto shrink-0 ${
      dark ? 'bg-slate-800 border-b border-slate-700' : 'bg-blue-900'
    }`} style={{ scrollbarWidth: 'thin' }}>
      {abas.map((aba) => (
        <button
          key={aba.id}
          onClick={() => setAbaAtiva(aba.id)}
          className={`px-3.5 py-2 text-[13px] font-medium whitespace-nowrap border-b-[3px] transition-colors cursor-pointer ${
            aba.id === abaAtiva
              ? 'text-white border-blue-400 font-bold'
              : `${dark ? 'text-slate-400 hover:text-slate-200' : 'text-white/60 hover:text-white hover:bg-white/5'} border-transparent`
          }`}
        >
          {aba.nome}
        </button>
      ))}
    </div>
  )
}
