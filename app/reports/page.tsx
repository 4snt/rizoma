'use client'

// Lista de Laudos (Reports) entre projetos. Backend expõe GET /reports
// (projeto vira agregador, filtro opcional), 1 query só; sem mais o N+1
// projeto-por-projeto que essa tela tinha.

import useSWR from 'swr'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'

export default function ReportsPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const { data: reports } = useSWR(token ? ['all-reports', token] : null, () => api.getAllReports(token!))

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Laudos</h1>
        <p className="page-subtitle">Todos os laudos gerados, em qualquer projeto</p>
      </div>

      {!reports && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {reports && reports.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum laudo gerado ainda.</span>
        </div>
      )}
      {reports && reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reports.map(r => {
            const isSigned = r.status === 'published'
            return (
              <Link key={r.id} href={`/reports/${r.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{r.code}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.project_code}</span>
                  <span className="badge badge-purple">v{r.version}</span>
                  <span className={`badge ${isSigned ? 'badge-green' : 'badge-amber'}`}>{isSigned ? 'assinado' : r.status}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
