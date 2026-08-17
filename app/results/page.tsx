'use client'

// Lista de Resultados entre amostras/projetos. Backend expõe
// GET /lab/results (projeto e amostra viram agregador, filtro opcional),
// 1 query só (join + LATERAL pra versão corrente); sem mais o N+1 de
// 3 níveis (projeto→amostra→resultado) que essa tela tinha.

import useSWR from 'swr'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'

function statusBadge(status: string) {
  if (status === 'approved') return <span className="badge badge-green">approved</span>
  if (status === 'retracted') return <span className="badge badge-red">retracted</span>
  return <span className="badge badge-amber">{status}</span>
}

export default function ResultsPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const { data: results } = useSWR(token ? ['all-results', token] : null, () => api.getAllResults(token!))

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Resultados</h1>
        <p className="page-subtitle">Todos os resultados lançados, em qualquer amostra</p>
      </div>

      {!results && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {results && results.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum resultado lançado ainda.</span>
        </div>
      )}
      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map(r => (
            // Detalhe/correção de resultado vive na tela da amostra (não há
            // /results/[id] próprio) — o link leva pra lá.
            <Link key={r.id} href={`/samples/${r.sample_id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{r.analyte}</span>
                {r.method && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.method}</span>}
                <span style={{ fontSize: 12, color: 'var(--text-3)', flex: 1 }}>{r.project_code} · {r.sample_code}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.current.display_value} {r.current.unit}</span>
                {statusBadge(r.current.status)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
