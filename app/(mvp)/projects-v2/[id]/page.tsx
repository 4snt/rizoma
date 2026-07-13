'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiV2Client, type ProjectV2 } from '@/lib/api-v2'
import { qk } from '@/lib/query-client'
import { useOrg } from '@/components/providers/OrgProvider'
import { ErrorBanner, PageHeader } from '@/components/mvp/Primitives'
import { SamplesTab } from '@/components/mvp/SamplesTab'
import { FilesTab } from '@/components/mvp/FilesTab'
import { JobsTab } from '@/components/mvp/JobsTab'
import { ResultsTab } from '@/components/mvp/ResultsTab'
import { ReportsTab } from '@/components/mvp/ReportsTab'

const TABS = ['Amostras', 'Arquivos', 'Jobs', 'Resultados', 'Laudos'] as const
type Tab = (typeof TABS)[number]

export default function ProjectV2DetailPage({ params }: { params: { id: string } }) {
  const projectId = params.id
  const { organizationId } = useOrg()
  const [tab, setTab] = useState<Tab>('Amostras')

  const project = useQuery<ProjectV2>({
    queryKey: qk.project(organizationId, projectId),
    queryFn: () => apiV2Client.getProject(projectId),
  })

  return (
    <div className="fade-in">
      <div className="breadcrumb">
        <Link href="/projects-v2">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{project.data?.code ?? '…'}</span>
      </div>

      <PageHeader
        title={project.data?.name ?? 'Projeto'}
        subtitle={project.data?.description ?? undefined}
      />

      <ErrorBanner error={project.error} />

      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === t ? 'var(--cyan)' : 'transparent'}`,
              color: tab === t ? 'var(--cyan)' : 'var(--text-2)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 14px',
              whiteSpace: 'nowrap',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Amostras' && <SamplesTab projectId={projectId} />}
      {tab === 'Arquivos' && <FilesTab projectId={projectId} />}
      {tab === 'Jobs' && <JobsTab projectId={projectId} />}
      {tab === 'Resultados' && <ResultsTab projectId={projectId} />}
      {tab === 'Laudos' && <ReportsTab projectId={projectId} />}
    </div>
  )
}
