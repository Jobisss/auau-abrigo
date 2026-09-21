/**
 * Google Analytics 4 (gtag.js).
 *
 * - Só liga com `VITE_GA_ID` preenchido e no build de produção (o `bun run dev` não suja as estatísticas).
 * - O app é uma SPA: o GA não percebe troca de tela sozinho, então o page view é
 *   enviado a cada mudança de rota (`trackPageView`), com o envio automático desligado.
 * - Telas do painel (/admin) não são contadas.
 */

/** ID de medição do app (público — vai pro navegador de qualquer jeito). `VITE_GA_ID=` vazio desliga. */
const DEFAULT_GA_ID = 'G-T4K05LH5JX'
const GA_ID = (import.meta.env.VITE_GA_ID ?? DEFAULT_GA_ID).trim()
const ENABLED = import.meta.env.PROD && /^G-[A-Z0-9]+$/.test(GA_ID)

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

let started = false

function start() {
  if (!ENABLED || started) return
  started = true

  window.dataLayer = window.dataLayer ?? []
  // O gtag.js exige o objeto `arguments`, não um array
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(script)
}

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/')

export function trackPageView(path: string) {
  if (!ENABLED || isAdminPath(path)) return
  start()
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

/** Eventos do fluxo (aparecem em Relatórios → Engajamento → Eventos). */
export type AnalyticsEvent = 'pet_cadastrado' | 'pix_copiado' | 'comprovante_whatsapp' | 'story_compartilhado'

export function track(event: AnalyticsEvent, params?: Record<string, string | number>) {
  if (!ENABLED || isAdminPath(window.location.pathname)) return
  start()
  window.gtag?.('event', event, params)
}
