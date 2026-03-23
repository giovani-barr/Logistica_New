import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RaioXApp from './RaioXApp'

const rootEl = document.getElementById('raio-x-root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <RaioXApp />
    </StrictMode>
  )
}
