'use client'

// Lista de Amostras entre projetos. Backend expõe GET /lims/samples
// (projeto vira agregador, filtro opcional — não pré-requisito de rota),
// 1 query só; sem mais o N+1 projeto-por-projeto que essa tela tinha.

import useSWR from 'swr'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'

export default function SamplesPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const { data: samples } = useSWR(token ? ['all-samples', token] : null, () => api.getAllSamples(token!))

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Amostras</h1>
        <p className="page-subtitle">Todas as amostras registradas, em qualquer projeto</p>
      </div>

      {!samples && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>carregando...</div>}
      {samples && samples.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhuma amostra registrada ainda.</span>
        </div>
      )}
      {samples && samples.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {samples.map(s => (
            <Link key={s.id} href={`/samples/${s.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{s.code}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', flex: 1 }}>{s.project_code} · {s.project_name}</span>
                <span className="badge badge-blue">{s.matrix}</span>
                {s.treatment_group && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.treatment_group}</span>}
                <span className="badge badge-cyan">{s.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
