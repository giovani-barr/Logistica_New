import { useEffect } from 'react'
import { useRaioX } from '../context/RaioXContext'
import Header from './Header'
import TabBar from './TabBar'
import AbaContent from './AbaContent'
import ConfigModal from './config/ConfigModal'

export default function RaioXModal() {
  const { onClose, theme, isFullscreen } = useRaioX()

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const dark = theme === 'dark'

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-2"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-screen h-screen rounded-none'
            : 'w-[92vw] h-[88vh] max-w-[1600px] rounded-xl'
        } ${dark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <Header />
        <TabBar />
        <AbaContent />
      </div>
      <ConfigModal />
    </div>
  )
}
