/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PIX_KEY: string
  readonly VITE_PIX_MERCHANT_NAME: string
  readonly VITE_PIX_MERCHANT_CITY: string
  /** ID do Google Analytics 4 (G-XXXXXXXXXX). Vazio desliga. */
  readonly VITE_GA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
