import { useRaioX } from '../context/RaioXContext'
import { RefreshCw, Settings, Maximize2, Minimize2, Sun, Moon, X } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const {
    pedido, onClose, theme, toggleTheme,
    abaAtiva, loading, reloadAba,
    isFullscreen, setIsFullscreen,
  } = useRaioX()
  const [configOpen, setConfigOpen] = useState(false)

  const titulo = (pedido.clienteNome || 'Cliente') +
    (pedido.numeroPedido ? ` — #${pedido.numeroPedido}` : '')

  const dark = theme === 'dark'

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 shrink-0 ${
      dark ? 'bg-slate-800 border-b border-slate-700' : 'bg-gradient-to-r from-blue-700 to-blue-900 text-white'
    }`}>
      <h2 className="text-base font-bold truncate flex items-center gap-2">
        <span className="text-lg">🔍</span>
        <span>{titulo}</span>
      </h2>
      <div className="flex items-center gap-1">
        <HdrBtn
          title="Recarregar dados"
          onClick={() => reloadAba(abaAtiva)}
          disabled={loading}
          icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}
          dark={dark}
        />
        <HdrBtn
          title="Configurar abas"
          onClick={() => window.dispatchEvent(new CustomEvent('rx-open-config'))}
          icon={<Settings size={16} />}
          dark={dark}
        />
        <HdrBtn
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          onClick={toggleTheme}
          icon={dark ? <Sun size={16} /> : <Moon size={16} />}
          dark={dark}
        />
        <HdrBtn
          title={isFullscreen ? 'Sair de tela cheia' : 'Tela cheia'}
          onClick={() => setIsFullscreen(v => !v)}
          icon={isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          dark={dark}
        />
        <HdrBtn title="Fechar" onClick={onClose} icon={<X size={16} />} dark={dark} className="ml-1" />
      </div>
    </div>
  )
}

function HdrBtn({ title, onClick, icon, dark, className = '', disabled = false }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${className} ${
        dark
          ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
          : 'hover:bg-white/20 text-white/80 hover:text-white'
      }`}
    >
      {icon}
    </button>
  )
}
