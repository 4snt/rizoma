'use client'

/**
 * Verificação pública de laudo — destino do QR Code impresso no PDF.
 * Sem autenticação: não usa OrgProvider nem token (o endpoint é público).
 */

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiV2Client, type ReportVerification } from '@/lib/api-v2'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)', textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )
}

function VerifyContent({ reportId }: { reportId: string }) {
  const searchParams = useSearchParams()
  const hash = searchParams.get('hash') ?? ''

  const verification = useQuery<ReportVerification>({
    queryKey: ['verify', reportId, hash],
    queryFn: () => apiV2Client.verifyReport(reportId, hash),
    enabled: Boolean(hash),
    retry: false,
  })

  if (!hash) {
    return (
      <p style={{ color: 'var(--amber)', fontSize: 13 }}>
        Falta o parâmetro <code>?hash=</code>. Use o QR Code impresso no laudo.
      </p>
    )
  }

  if (verification.isLoading) return <div className="skeleton" style={{ height: 120 }} />

  if (verification.error) {
    return (
      <div>
        <div className="badge badge-red" style={{ fontSize: 13, padding: '6px 12px' }}>
          ✗ Não foi possível verificar
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: 12, marginTop: 10 }}>
          {verification.error instanceof Error ? verification.error.message : 'Erro desconhecido'}
        </p>
      </div>
    )
  }

  const v = verification.data
  if (!v) return null

  return (
    <div>
      <div
        className={`badge ${v.valid ? 'badge-green' : 'badge-red'}`}
        style={{ fontSize: 14, padding: '8px 14px', marginBottom: 18 }}
      >
        {v.valid ? '✓ Laudo autêntico' : '✗ Laudo NÃO confere'}
      </div>

      {!v.valid && v.reason && (
        <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 14 }}>{v.reason}</p>
      )}

      <Row label="Laudo" value={v.title ?? '—'} />
      <Row label="Código" value={v.code ?? '—'} />
      <Row label="Projeto" value={v.project_code ?? '—'} />
      <Row label="Organização" value={v.organization ?? '—'} />
      <Row
        label="Assinado em"
        value={v.signed_at ? new Date(v.signed_at).toLocaleString('pt-BR') : '—'}
      />
      <Row label="Assinado por" value={v.signed_by ?? '—'} />
      <Row label="Hash (SHA-256)" value={v.hash ?? hash} />
    </div>
  )
}

export default function VerifyReportPage({ params }: { params: { id: string } }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 560 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🧬</span>
          <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>Rizoma</span>
        </div>
        <h1 style={{ fontSize: 18, marginBottom: 4 }}>Verificação de laudo</h1>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20 }}>
          Confere o hash impresso no PDF contra o registro assinado no servidor.
        </p>

        <Suspense fallback={<div className="skeleton" style={{ height: 120 }} />}>
          <VerifyContent reportId={params.id} />
        </Suspense>

        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 20 }}>
          Página pública · UFVJM — Bioinformática
        </p>
      </div>
    </main>
  )
}
