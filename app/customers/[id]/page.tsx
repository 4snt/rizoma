'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api, type Project } from '@/lib/api'

function markerBadge(marker: string | null) {
  if (!marker) return null
  if (marker === 'ITS') return <span className="badge badge-purple">ITS</span>
  return <span className="badge badge-blue">{marker}</span>
}

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken

  const { data: customer, error: customerError } = useSWR(
    id && token ? ['customer', id, token] : null,
    () => api.getCustomer(token!, id),
  )

  // getProjects não filtra por cliente no backend — filtramos aqui.
  const { data: allProjects } = useSWR(
    token ? ['projects', token] : null,
    () => api.getProjects(token!),
  )
  const projects = (allProjects ?? []).filter((p: Project) => p.customer_id === id)

  if (customerError) {
    return (
      <div className="card" style={{ padding: 20, color: 'var(--red)' }}>
        Erro ao carregar cliente.
      </div>
    )
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/customers">Clientes</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{customer?.name ?? '...'}</span>
      </div>

      <div className="page-header">
        {customer ? (
          <h1 className="page-title" style={{ color: 'var(--cyan)' }}>{customer.name}</h1>
        ) : (
          <div className="skeleton" style={{ height: 28, width: 240 }} />
        )}
        {customer && (
          <div style={{ marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)' }}>
            {customer.document && <span className="mono">{customer.document}</span>}
            {customer.contact_email && <span>✉ {customer.contact_email}</span>}
            {customer.contact_phone && <span>☎ {customer.contact_phone}</span>}
          </div>
        )}
        {customer?.notes && (
          <p className="page-subtitle" style={{ marginTop: 8 }}>{customer.notes}</p>
        )}
      </div>

      <div className="section-title">Projetos deste cliente</div>

      {projects.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Nenhum projeto vinculado.</span>
        </div>
      )}

      {projects.length > 0 && (
        <div className="project-grid">
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: 16, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{p.code}</span>
                  {markerBadge(p.marker_type)}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}>{p.name}</div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>{p.status}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
