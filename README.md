# bio-frontend

Interface web da plataforma de análise de micobioma e transcriptômica — TCC de bioinformática.

Next.js 14 (App Router) com visualizações científicas interativas via Plotly.js e Cytoscape.js.

---

## Status de implementação

| Componente | Status | Detalhe |
|---|---|---|
| Estrutura App Router | ✅ Pronto | `/projects`, `/analysis/[id]`, `/network/[id]`, `/diversity`, `/cross-project`, `/jobs` |
| Autenticação (NextAuth v5) | ✅ Pronto | Google OAuth, proteção de rotas e sessões |
| Painel Admin | ✅ Pronto | Gerenciamento de projetos e usuários (`/admin/projects`, `/admin/users`) |
| `lib/api.ts` — cliente tipado REST | ✅ Pronto | Wrapper sobre `fetch` com interceptação de tokens e tipagem completa |
| `lib/websocket.ts` — cliente WS | ✅ Pronto | Conecta no `/api/v1/jobs/ws/status`, atualizações em tempo real |
| Página `/projects` | ✅ Pronto | Listagem dinâmica com badges de status e marcador |
| Página `/analysis/[id]` (volcano / MA) | ✅ Pronto | Plots interativos com Plotly + tabela de DEGs filtrável |
| Página `/jobs` (fila em tempo real) | ✅ Pronto | Dashboard com progresso, fila e histórico recente |
| Artifacts & Upload | ✅ Pronto | Upload de FASTQ/RDS e auto-fill via MinIO (phyloseq) |
| Página `/network/[id]` (Cytoscape) | 🔧 Em progresso | Integração com SpiecEasi/NetCoMi pendente |
| Página `/diversity` (PCoA) | 🔧 Em progresso | Alpha/Beta diversity — aguarda integração com backend |

---

## Contexto

Frontend para acompanhar e visualizar as análises de três projetos paralelos (INOVAHERB, Pós-Fogo, Biorremediação). Consome a API REST do [bio-platform](../bio-platform) e recebe atualizações em tempo real via WebSocket.

**Segurança:** Acesso restrito via Google OAuth. Usuários `admin` podem criar projetos e gerenciar permissões.

---

## Stack

| Lib | Uso |
|-----|-----|
| Next.js 14 App Router | Roteamento e SSR |
| NextAuth.js v5 | Autenticação (Auth.js) |
| Plotly.js | PCoA, volcano plot, MA plot, heatmaps |
| Cytoscape.js | Redes microbianas interativas |
| Recharts | Barras de progresso e estatísticas de jobs |
| SWR | Cache e revalidação de dados da API |
| WebSocket nativo | Status de jobs em tempo real |

---

## Rodar localmente

1. Configure as credenciais do Google Cloud Console para o NextAuth.
2. Copie o `.env.example`:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Sobe em `http://localhost:3000`. Requer o [bio-platform](../bio-platform) rodando em `:8000`.

Para build de produção:

```bash
npm run build
npm start
```

---

## Rotas

| Rota | O que mostra | Proteção |
|------|-------------|-----------|
| `/` | Home com navegação | — |
| `/login` | Página de autenticação Google | — |
| `/projects` | Lista de projetos com status | Auth |
| `/analysis/[id]` | Volcano plot, MA plot, tabela de DEGs | Auth |
| `/jobs` | Fila de análises e progresso em tempo real | Auth |
| `/admin/projects` | Gerenciamento de projetos (Novo/Editar) | Admin |
| `/admin/users` | Gestão de permissões de usuários | Admin |
| `/network/[id]` | Rede microbiana interativa | Auth |
| `/diversity` | PCoA beta diversity, alpha diversity | Auth |

---

## Estrutura de pastas

```
bio-frontend/
├── app/                    → páginas (App Router)
│   ├── admin/              → painel administrativo
│   ├── analysis/[id]/      → detalhe da análise estatística
│   ├── projects/           → catálogo de projetos
│   ├── jobs/               → monitoramento de jobs
│   └── ...
├── components/
│   ├── ui/                 → Shell, Sidebar, Providers
│   └── charts/             → Wrappers Plotly e Recharts
├── lib/
│   ├── api.ts              → cliente REST tipado
│   ├── websocket.ts        → gerenciador de WebSocket
│   └── analyses-catalog.ts → definições de tipos de análises
├── auth.ts                 → configuração do NextAuth v5
└── middleware.ts           → proteção de rotas por sessão
```

---

## Comunicação com o backend

### REST (dados)

```typescript
import { api } from '@/lib/api'

const projects = await api.getProjects()
const results  = await api.getAnalysisResults(jobId)
const degs     = await api.searchDegs('Desulfovibrio', 'biorremediation')
```

Todas as chamadas passam por `lib/api.ts` — nenhuma página faz `fetch` direto.

### WebSocket (tempo real)

```typescript
import { connectJobStatusSocket } from '@/lib/websocket'

const disconnect = connectJobStatusSocket((jobId, status) => {
  // status: 'queued' | 'running' | 'done' | 'failed'
})
```

---

## Adicionar um novo gráfico

1. Criar componente em `components/charts/MeuGrafico.tsx`
2. Importar `Plot` com `dynamic(() => import('react-plotly.js'), { ssr: false })` — Plotly não roda no servidor
3. Consumir dados via `useSWR` apontando para `api.*`
4. Adicionar a rota em `app/` se for uma página nova

Exemplo mínimo de gráfico Plotly:

```tsx
'use client'
import dynamic from 'next/dynamic'
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

export function VolcanoPlot({ degs }: { degs: DegResult[] }) {
  return (
    <Plot
      data={[{
        type: 'scatter',
        mode: 'markers',
        x: degs.map(d => d.log2_fold_change),
        y: degs.map(d => -Math.log10(d.p_adjusted)),
        text: degs.map(d => d.gene_id),
      }]}
      layout={{ title: 'Volcano Plot', xaxis: { title: 'log2FC' }, yaxis: { title: '-log10(padj)' } }}
    />
  )
}
```

---

## Variáveis de ambiente

```bash
NEXTAUTH_SECRET=...                         # Segredo para sessões
NEXTAUTH_URL=http://localhost:3000          # URL base do site
GOOGLE_CLIENT_ID=...                        # OAuth Client ID
GOOGLE_CLIENT_SECRET=...                    # OAuth Client Secret

NEXT_PUBLIC_API_URL=http://localhost:8000   # URL da API REST
NEXT_PUBLIC_WS_URL=ws://localhost:8000      # URL do WebSocket
```

---

## Deploy

A imagem Docker é multi-stage (builder → runner) com output `standalone`:

```bash
docker build -t ghcr.io/org/bio-frontend:latest .
docker push ghcr.io/org/bio-frontend:latest
```

Para a comparação ao vivo com o SENAITE na defesa do TCC, esse frontend roda
num cluster k8s local em vez de ir pro GHCR — build + import direto no
containerd, gerenciado pelo Terraform em
[`rizoma-backend/infra/terraform-local`](https://github.com/4snt/rizoma-backend/tree/master/infra/terraform-local)
(ver ADR-014 no backend).
