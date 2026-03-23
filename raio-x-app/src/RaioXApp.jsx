import { useState, useEffect, useCallback } from 'react'
import { RaioXProvider } from './context/RaioXContext'
import RaioXModal from './components/RaioXModal'

export default function RaioXApp() {
  const [isOpen, setIsOpen] = useState(false)
  const [pedido, setPedido] = useState(null)

  const handleOpen = useCallback((e) => {
    const d = e.detail || {}
    setPedido({
      pedidoId: d.pedidoId ? parseInt(d.pedidoId, 10) : null,
      numeroPedido: d.numeroPedido || '',
      clienteNome: d.clienteNome || '',
      pedidoData: d.pedidoData || null,
    })
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('open-raio-x', handleOpen)
    window.addEventListener('close-raio-x', handleClose)
    return () => {
      window.removeEventListener('open-raio-x', handleOpen)
      window.removeEventListener('close-raio-x', handleClose)
    }
  }, [handleOpen, handleClose])

  if (!isOpen || !pedido) return null

  return (
    <RaioXProvider pedido={pedido} onClose={handleClose}>
      <RaioXModal />
    </RaioXProvider>
  )
}
