<div align="center">

<img src="public/favicon.svg" width="96" alt="Logo AuAu Abrigo" />

# AuAu Abrigo 🐾

**Mostre seu pet pra todo mundo — e ajude o abrigo a cuidar de mais patinhas.**

App web mobile-first feito para o **[Abrigo Toca de Assis](https://www.instagram.com/abrigotocadeassisivaipora/)**, ONG de proteção animal de Ivaiporã - PR.

<br />

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=1A2B4A)
![Vite](https://img.shields.io/badge/Vite-8-FEC601?style=for-the-badge&logo=vite&logoColor=1A2B4A)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2364AA?style=for-the-badge&logo=typescript&logoColor=white)
![PIX](https://img.shields.io/badge/PIX-pix--utils-73BFB8?style=for-the-badge&logo=pix&logoColor=1A2B4A)

</div>

---

## 💡 A ideia

O tutor publica o seu bichinho (cachorro, gato ou qualquer pet) com foto e curiosidades. Pra ele aparecer no **feed estilo Reels**, faz uma doação pro abrigo e manda o comprovante no WhatsApp. A equipe confere e aprova — pronto, o pet entra no feed e todo mundo ajuda o abrigo junto. 💛

```mermaid
flowchart LR
    A([📖 Como funciona]) --> B([📸 Adiciona o pet])
    B --> C([💸 Doação PIX])
    C --> D([💬 Envia comprovante<br/>no WhatsApp])
    D --> E([⏳ Aguarda aprovação])
    E -. abrigo aprova no painel .-> F([🎬 Pet no Reels!])
    F --> G([📲 Compartilha<br/>nos Stories])
```

## ✨ O que tem

| | |
| --- | --- |
| 🎬 **Feed Reels** | Rolagem vertical em tela cheia, curtida com toque duplo, coraçõezinhos e link direto pra cada pet |
| 📸 **Cadastro do pet** | Foto (toque ou arrasta-e-solta), nome, idade, comida exótica favorita, como foi adotado, brincadeira favorita |
| 💸 **Doação via PIX** | R$ 5, 10, 25 ou outro valor — QR Code e copia-e-cola gerados na hora com `pix-utils` |
| 💬 **Comprovante no WhatsApp** | Mensagem já preenchida com o valor e o nome do pet |
| 📲 **Compartilhar** | Folha de compartilhamento nativa do celular (Stories, WhatsApp…) com a foto do pet |
| 🏠 **Conheça o abrigo** | Missão, outras formas de ajudar e link pro Instagram |
| 🛡️ **Painel do abrigo** | Aprovar, ocultar e remover pets, com "Desfazer" — cards no celular, tabela no desktop |
| 🎨 **Capricho visual** | Estilo "desenhado à mão", botões com mola, entradas em cascata, confete no final — e respeita quem pede menos movimento |

## 🚀 Rodando

Precisa de **Node 20+**.

```bash
npm install
cp .env.example .env
npm run dev
```

Abre em **http://localhost:5173**. Pro painel, vá em `/admin/login` — enquanto não há backend, qualquer e-mail válido com senha de 4+ caracteres entra.

```bash
npm run build     # build de produção em dist/
npm run preview   # serve o build localmente
```

## ⚙️ Configuração (`.env`)

| Variável | Pra que serve |
| --- | --- |
| `VITE_PIX_KEY` | Chave PIX **do abrigo** (telefone `+55DDDNUMERO`, e-mail, CPF/CNPJ ou aleatória). **Vazia** = o app esconde o QR e orienta a doar pelo WhatsApp |
| `VITE_PIX_MERCHANT_NAME` | Nome do recebedor no PIX (até 25 caracteres, sem acento) |
| `VITE_PIX_MERCHANT_CITY` | Cidade do recebedor (até 15 caracteres, sem acento) |

> [!NOTE]
> O Vite só lê o `.env` quando inicia — depois de mudar, reinicie o `npm run dev`.

## 🗺️ Telas

| Rota | Tela |
| --- | --- |
| `/` | Como funciona (passo a passo) |
| `/adicionar` | Adicione o seu pet |
| `/doacao` | Escolha do valor + PIX |
| `/enviar-comprovante` | Redireciona pro WhatsApp |
| `/obrigado` | Aguardando aprovação 🎉 |
| `/reels` | Feed de pets aprovados (`?pet=<id>` abre direto num pet) |
| `/compartilhar/:id` | Compartilhar o pet nos Stories |
| `/abrigo` | Conheça o abrigo |
| `/admin/login` → `/admin` | Painel de aprovação |

## 🧱 Estrutura

```
src/
├── App.tsx               # rotas
├── main.tsx
├── styles.css            # tokens (cores, sombras, motion) + componentes base
├── screens.css           # estilos e animações de cada tela
├── components/ui.tsx     # header, menu de suporte, toast, modal, confete, count-up…
├── data/mock.ts          # dados do abrigo e pets de exemplo
├── lib/pix.ts            # geração do PIX (BR Code + QR)
├── state/AppState.tsx    # estado global (localStorage)
└── screens/
    ├── HowItWorks.tsx  AddPet.tsx  Donation.tsx  SendReceipt.tsx  Thanks.tsx
    ├── Reels.tsx  SharePreview.tsx  Shelter.tsx
    └── admin/  AdminLogin.tsx  AdminDashboard.tsx
```

## 🎨 Paleta

| | Cor | Uso |
| --- | --- | --- |
| ![#1A2B4A](https://placehold.co/16x16/1A2B4A/1A2B4A.png) | `#1A2B4A` | Tinta: contornos, sombras e textos |
| ![#2364AA](https://placehold.co/16x16/2364AA/2364AA.png) | `#2364AA` | Azul: botões principais e títulos |
| ![#FEC601](https://placehold.co/16x16/FEC601/FEC601.png) | `#FEC601` | Amarelo: ações secundárias e destaques |
| ![#73BFB8](https://placehold.co/16x16/73BFB8/73BFB8.png) | `#73BFB8` | Verde-água: cards de info e sucesso |
| ![#EA7317](https://placehold.co/16x16/EA7317/EA7317.png) | `#EA7317` | Laranja: avisos e pendências |
| ![#FFF9F0](https://placehold.co/16x16/FFF9F0/FFF9F0.png) | `#FFF9F0` | Creme: fundo |

Fontes: **Balsamiq Sans** (texto) e **Just Me Again Down Here** (títulos à mão).

## 🛣️ Próximos passos

- [ ] Backend: salvar pets, fotos e aprovações de verdade
- [ ] Login real pro painel do abrigo
- [ ] Chave PIX oficial do abrigo no `.env`
- [ ] Upload de comprovante direto no app

## 💛 Ajude o abrigo

Mesmo sem o app: o **Abrigo Toca de Assis** recebe ração e produtos de limpeza em pontos de coleta em Ivaiporã. Siga e ajude em **[@abrigotocadeassisivaipora](https://www.instagram.com/abrigotocadeassisivaipora/)**.

<div align="center">
<br />
Feito com 🐾 para quem só precisa de um lar.
</div>
