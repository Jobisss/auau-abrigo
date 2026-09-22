/**
 * Navegador interno do Instagram/Facebook (link da bio abre nele): não compartilha arquivo
 * nem baixa imagem gerada, então o app tenta sair dele pro navegador de verdade.
 */
export const IN_APP = /Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent)
export const ANDROID = /Android/i.test(navigator.userAgent)

/**
 * No Android um link intent:// sai do Instagram e abre a mesma página no navegador padrão.
 * No iPhone não tem como — lá só dá pra pedir "••• → Abrir no navegador externo".
 */
export function openInBrowser() {
  const { host, pathname, search } = location
  location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;end`
}
