'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { can } from '@/lib/permissions'
import { SampleWizard } from '@/components/samples/SampleWizard'

function NewSampleContent() {
  const params = useParams()
  const projectId = params?.id as string
  const searchParams = useSearchParams()
  const initialSampleId = searchParams?.get('sample') || null
  const stepParam = searchParams?.get('step')
  const initialStep = stepParam ? Number(stepParam) : undefined

  const { data: session, status } = useSession()
  const token = session?.accessToken
  const role = session?.role

  const { data: project } = useSWR(
    projectId && token ? ['project', projectId, token] : null,
    () => api.getProject(token!, projectId),
  )

  const { data: existing } = useSWR(
    initialSampleId && token ? ['sample', initialSampleId, token] : null,
    () => api.getLimsSample(token!, initialSampleId!),
  )

  const allowed = can(role, 'sample:write')

  return (
    <>
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={`/projects/${projectId}`}>{project?.code ?? '...'}</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={`/projects/${projectId}/samples`}>Amostras</Link>
        <span className="breadcrumb-sep">/</span>
        <span>Nova amostra</span>
      </div>

      <div className="page-header">
        <h1 className="page-title">
          {initialSampleId
            ? <>Continuar cadastro — <span className="mono" style={{ color: 'var(--cyan)' }}>{existing?.code ?? '...'}</span></>
            : 'Registrar isolado'}
        </h1>
        <p className="page-subtitle">
          Cadastro guiado em etapas: identificação, origem, cultivo, testes, genes e armazenamento · {project?.name ?? '...'}
        </p>
      </div>

      {status === 'loading' && (
        <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />
      )}

      {status !== 'loading' && !allowed && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>
            Você não tem permissão para registrar amostras neste projeto.
          </div>
          <Link href={`/projects/${projectId}/samples`} style={{ color: 'var(--cyan)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            ← Voltar para amostras
          </Link>
        </div>
      )}

      {status !== 'loading' && allowed && projectId && (
        <SampleWizard projectId={projectId} initialSampleId={initialSampleId} initialStep={initialStep} />
      )}
    </>
  )
}

export default function NewSamplePage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 160, borderRadius: 8 }} />}>
      <NewSampleContent />
    </Suspense>
  )
}
