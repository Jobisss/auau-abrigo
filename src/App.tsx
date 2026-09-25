import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { trackPageView } from './lib/analytics'
import { api } from './lib/api'
import { ANDROID, IN_APP, openInBrowser } from './lib/inApp'
import { AppStateProvider, useApp } from './state/AppState'
import HowItWorks from './screens/HowItWorks'
import AddPet from './screens/AddPet'
import Donation from './screens/Donation'
import SendReceipt from './screens/SendReceipt'
import Thanks from './screens/Thanks'
import Shelter from './screens/Shelter'
import Reels from './screens/Reels'
import SharePreview from './screens/SharePreview'
import ThanksVideo from './screens/ThanksVideo'
import AdminLogin from './screens/admin/AdminLogin'
import AdminDashboard from './screens/admin/AdminDashboard'

// Link da bio abre no navegador do Instagram: no Android já pula pro navegador de verdade
// (se o Instagram barrar, a tela de compartilhar ainda tem o botão "Abrir no navegador")
if (IN_APP && ANDROID && !location.pathname.startsWith('/admin')) openInBrowser()

/**
 * Fluxo do usuário:
 *   /                   Como funciona (passo a passo)
 *   /adicionar          Adicione o seu pet
 *   /doacao             Escolha do valor + PIX
 *   /enviar-comprovante Redireciona pro WhatsApp
 *   /obrigado           Aguardando aprovação
 *   /reels              Feed de pets aprovados
 *   /compartilhar/:id   Compartilhar o pet nos Stories
 *   /video              Vídeo de agradecimento pros pets que já ajudaram
 *   /abrigo             Conheça o abrigo
 * Painel do abrigo:
 *   /admin/login → /admin
 */
export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <ScrollToTop />
        <PageViews />
        <ResumeFlow />
        <Routes>
          <Route path="/" element={<HowItWorks />} />
          <Route path="/adicionar" element={<AddPet />} />
          <Route path="/doacao" element={<Donation />} />
          <Route path="/enviar-comprovante" element={<SendReceipt />} />
          <Route path="/obrigado" element={<Thanks />} />
          <Route path="/abrigo" element={<Shelter />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/compartilhar/:petId" element={<SharePreview />} />
          <Route path="/video" element={<ThanksVideo />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  )
}

/**
 * Quem sai no meio do fluxo (foi pagar no app do banco, abriu o WhatsApp…) e reabre o app
 * volta de onde parou: pro PIX se ainda não enviou o comprovante, pra tela de espera se já.
 * Só age na primeira tela carregada e só se for a inicial — navegar dentro do app não redireciona.
 */
function ResumeFlow() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { draftPet, draftStep, clearDraft } = useApp()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    if (pathname !== '/' || !draftPet) return

    if (draftStep === 'pix') {
      navigate('/doacao', { replace: true })
      return
    }
    // Já enviou: se o abrigo aprovou, mostra o pet no feed e encerra o fluxo; senão, tela de espera
    api.pets
      .get(draftPet.id)
      .then(() => {
        clearDraft()
        navigate(`/reels?pet=${encodeURIComponent(draftPet.id)}`, { replace: true })
      })
      .catch(() => navigate('/obrigado', { replace: true }))
  }, [pathname, draftPet, draftStep, clearDraft, navigate])

  return null
}

/** Conta cada tela vista no Google Analytics (SPA não recarrega a página). */
function PageViews() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    trackPageView(pathname + search)
  }, [pathname, search])
  return null
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}
