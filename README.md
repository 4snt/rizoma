# rizoma — frontend

Interface web do Rizoma, o LIMS de laboratório ambiental — TCC de bioinformática, UFVJM.

Next.js 14 (App Router). O escopo é o núcleo de LIMS: projeto, amostra, cadeia
de custódia, resultado e laudo. As telas de metagenômica (ASV, diversidade,
PCoA, volcano/MA plot, redes microbianas) e a fila de jobs do R Worker foram
removidas do produto — o histórico continua no git.

---

## Status de implementação

| Componente | Status | Detalhe |
|---|---|---|
| Estrutura App Router | ✅ Pronto | `/projects`, `/samples`, `/results`, `/reports`, `/inventory`, `/interop` |
| Autenticação (NextAuth v5) | ✅ Pronto | Google OAuth, proteção de rotas e sessões |
| Painel Admin | ✅ Pronto | Projetos e usuários (`/admin/projects/new`, `/admin/members`) |
| `lib/api.ts` — cliente tipado REST | ✅ Pronto | Wrapper sobre `fetch` com token e tipagem completa |
| Projetos | ✅ Pronto | Cadastro mínimo (código, nome, descrição, responsável) |
| Amostras + cadeia de custódia | ✅ Pronto | Registro, transição de estado, hash chain, import/export CSV |
| Resultados e laudos | ✅ Pronto | Versionamento append-only, assinatura, verificação pública |
| Modo campo (offline) | 🔧 Em progresso | Outbox em IndexedDB (`lib/offline-outbox.ts`), rota `/field` |

---

## Contexto

Frontend do LIMS usado nos projetos INOVAHERB, Pós-Fogo e Biorremediação.
Consome a API REST do [rizoma-backend](https://github.com/4snt/rizoma-backend).

**Segurança:** acesso restrito via Google OAuth, só e-mails do domínio
configurado em `ALLOWED_EMAIL_DOMAIN`. Quem é `org_admin` cria projetos e
gerencia permissões.

---

## Stack

| Lib | Uso |
|-----|-----|
| Next.js 14 App Router | Roteamento e SSR |
| NextAuth.js v5 | Autenticação (Auth.js) |
| SWR | Cache e revalidação nas telas v1 |
| TanStack Query | Cache nas telas v2 (`/projects-v2`, `/field`) |
| idb-keyval | Outbox offline do modo campo |
| swagger-ui-react | `/docs` — OpenAPI da API |

---

## Rodar localmente

1. Configure as credenciais do Google Cloud Console para o NextAuth.
2. Copie o `.env.example`:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Sobe em `http://localhost:3000`. Requer o
[rizoma-backend](https://github.com/4snt/rizoma-backend) rodando em `:8000`.

Para build de produção:

```bash
npm run build
npm start
```

---

## Rotas

| Rota | O que mostra | Proteção |
|------|-------------|-----------|
| `/` | Dashboard com os projetos | Auth |
| `/login` | Página de autenticação Google | — |
| `/projects` | Lista de projetos | Auth |
| `/projects/[id]` | Visão geral do projeto e atalhos | Auth |
| `/projects/[id]/samples` | Registro de amostras do projeto | Auth |
| `/samples` | Amostras de todos os projetos | Auth |
| `/samples/[id]` | Amostra, transição de estado e cadeia de custódia | Auth |
| `/results`, `/reports` | Resultados e laudos | Auth |
| `/reports/[id]` | Laudo, versões e assinatura | Auth |
| `/verify/[id]` | Verificação pública do laudo (QR Code) | — |
| `/inventory/reagentes`, `/inventory/equipamentos` | Inventário | Auth |
| `/interop` | Webhooks e import/export | Auth |
| `/admin/projects/new` | Cadastro de projeto | `project:write` |
| `/admin/members` | Gestão de membros e papéis | `org_admin` |

---

## Fluxo básico

1. `/projects` → **Novo Projeto** → código, nome, descrição, responsável.
2. Ao criar, cai direto em `/projects/{id}/samples`.
3. **+ Registrar Amostra** (ou importar CSV) — a amostra nasce em `planned`.
4. Abrir a amostra e avançar a custódia: `planned → collected → in_transit →
   received → accepted → ...`. Cada transição vira um elo com hash encadeado.

---

## Estrutura de pastas

```
rizoma/
├── app/                    → páginas (App Router)
│   ├── admin/              → painel administrativo
│   ├── projects/           → projetos e amostras do projeto
│   ├── samples/            → amostras e cadeia de custódia
│   ├── reports/            → laudos
│   └── ...
├── components/
│   ├── ui/                 → Shell, Sidebar, Providers
│   ├── mvp/                → telas da API v2 (TanStack Query)
│   └── inventory/          → reagentes e equipamentos
├── lib/
│   ├── api.ts              → cliente REST tipado (SWR)
│   ├── api-v2.ts           → cliente da API v2
│   ├── offline-outbox.ts   → fila offline do modo campo
│   └── permissions.ts      → gating de escrita por papel
├── auth.ts                 → configuração do NextAuth v5
└── middleware.ts           → proteção de rotas por sessão
```

---

## Comunicação com o backend

```typescript
import { api } from '@/lib/api'

const projects = await api.getProjects(token)
const samples  = await api.getAllSamples(token, projectId)
const sample   = await api.createLimsSample(token, projectId, { code: 'AM-001', matrix: 'solo' })
```

Todas as chamadas passam por `lib/api.ts` (ou `lib/api-v2.ts` nas telas v2) —
nenhuma página faz `fetch` direto.

---

## Variáveis de ambiente

```bash
AUTH_SECRET=...                             # Segredo para sessões (NextAuth v5)
NEXTAUTH_URL=http://localhost:3000          # URL base do site
GOOGLE_CLIENT_ID=...                        # OAuth Client ID
GOOGLE_CLIENT_SECRET=...                    # OAuth Client Secret

NEXT_PUBLIC_API_URL=http://localhost:8000   # URL da API REST
```

---

## Deploy

A imagem Docker é multi-stage (builder → runner) com output `standalone`:

```bash
docker build -t ghcr.io/org/rizoma-frontend:latest .
docker push ghcr.io/org/rizoma-frontend:latest
```

Para a comparação ao vivo com o SENAITE na defesa do TCC, esse frontend roda
num cluster k8s local em vez de ir pro GHCR — build + import direto no
containerd, gerenciado pelo Terraform em
[`rizoma-backend/infra/terraform-local`](https://github.com/4snt/rizoma-backend/tree/master/infra/terraform-local)
(ver ADR-014 no backend).
