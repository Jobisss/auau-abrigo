# AuAu Abrigo

App web (mobile-first) para o **Abrigo Toca de Assis — Ivaiporã/PR**: tutores publicam seu pet num feed estilo Reels em troca de uma doação para o abrigo.

Só front-end por enquanto (sem backend) — o estado fica no `localStorage`.

## Rodando

```bash
npm install
cp .env.example .env
npm run dev
```

## Variáveis (`.env`)

| Variável | Uso |
| --- | --- |
| `VITE_PIX_KEY` | Chave PIX do abrigo. Vazia = app esconde QR/copia-e-cola e orienta doar pelo WhatsApp |
| `VITE_PIX_MERCHANT_NAME` | Nome do recebedor no PIX (máx. 25 caracteres, sem acento) |
| `VITE_PIX_MERCHANT_CITY` | Cidade do recebedor (máx. 15 caracteres, sem acento) |

## Telas

- `/` Como funciona · `/adicionar` Adicionar pet · `/doacao` Doação · `/enviar-comprovante` · `/obrigado`
- `/reels` Feed · `/compartilhar/:id` Compartilhar nos Stories · `/abrigo` Conheça o abrigo
- `/admin/login` → `/admin` Painel de aprovação

Stack: React 19 + Vite + TypeScript + react-router + lucide-react + pix-utils.
