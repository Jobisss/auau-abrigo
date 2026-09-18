import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppStateProvider } from './state/AppState'
import HowItWorks from './screens/HowItWorks'
import AddPet from './screens/AddPet'
import Donation from './screens/Donation'
import SendReceipt from './screens/SendReceipt'
import Thanks from './screens/Thanks'
import Shelter from './screens/Shelter'
import Reels from './screens/Reels'
import SharePreview from './screens/SharePreview'
import AdminLogin from './screens/admin/AdminLogin'
import AdminDashboard from './screens/admin/AdminDashboard'

/**
 * Fluxo do usuário:
 *   /                   Como funciona (passo a passo)
 *   /adicionar          Adicione o seu pet
 *   /doacao             Escolha do valor + PIX
 *   /enviar-comprovante Redireciona pro WhatsApp
 *   /obrigado           Aguardando aprovação
 *   /reels              Feed de pets aprovados
 *   /compartilhar/:id   Compartilhar o pet nos Stories
 *   /abrigo             Conheça o abrigo
 * Painel do abrigo:
 *   /admin/login → /admin
 */
export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HowItWorks />} />
          <Route path="/adicionar" element={<AddPet />} />
          <Route path="/doacao" element={<Donation />} />
          <Route path="/enviar-comprovante" element={<SendReceipt />} />
          <Route path="/obrigado" element={<Thanks />} />
          <Route path="/abrigo" element={<Shelter />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/compartilhar/:petId" element={<SharePreview />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}
