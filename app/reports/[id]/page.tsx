'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'

export default function ReportDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()
  const token = session?.accessToken

  const { data: report, error, mutate } = useSWR(
    id && token ? ['report', id, token] : null,
    () => api.getReport(token!, id),
  )

  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState('')

  async function handleSign() {
    if (!token || !id) return
    setSigning(true)
    setSignError('')
    try {
      await api.signReport(token, id)
      await mutate()
    } catch (e) {
      setSignError(e instanceof Error ? e.message : 'Erro ao assinar laudo.')
    } finally {
      setSigning(false)
    }
  }

  if (error) return <div className="card" style={{ padding: 20, color: 'var(--red)' }}>Erro ao carregar laudo.</div>
  if (!report) return <div className="skeleton" style={{ height: 28, width: 240 }} />

  // Backend usa 'published' como status pós-assinatura (ver
  // reports/repository.py — sign() faz UPDATE ... status = 'published'),
  // não 'signed'.
  const isSigned = report.status === 'published'
  const verifyUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify/${report.id}` : ''

  return (
    <>
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={`/projects/${report.project_id}/reports`}>Laudos</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{report.code}</span>
      </div>

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title mono" style={{ color: 'var(--cyan)' }}>{report.code}</h1>
            <span className={`badge ${isSigned ? 'badge-green' : 'badge-amber'}`}>
              {isSigned ? 'assinado' : 'rascunho'}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>v{report.version}</span>
          </div>
          <p className="page-subtitle" style={{ marginTop: 4 }}>{report.title}</p>
        </div>
        {!isSigned && (
          <button
            onClick={handleSign}
            disabled={signing}
            style={{
              background: 'var(--green)', color: '#050d1a', border: 'none',
              borderRadius: 'var(--shape-full)', fontWeight: 700, fontSize: 13,
              padding: '8px 18px', cursor: signing ? 'not-allowed' : 'pointer',
            }}
          >
            {signing ? 'Assinando...' : '✒ Assinar Laudo'}
          </button>
        )}
      </div>

      {signError && <div className="card" style={{ padding: 16, marginBottom: 16, color: 'var(--red)' }}>{signError}</div>}

      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isSigned && (
          <>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
              <span><span style={{ color: 'var(--text-3)' }}>Assinado em:</span>{' '}
                {report.signed_at ? new Date(report.signed_at).toLocaleString('pt-BR') : '—'}</span>
            </div>
            {report.sha256 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>SHA-256</div>
                <code className="mono" style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--text-2)' }}>{report.sha256}</code>
              </div>
            )}
            {report.download_url && (
              <a
                href={report.download_url}
                target="_blank" rel="noreferrer"
                style={{
                  alignSelf: 'flex-start', padding: '7px 16px', background: 'var(--cyan-dim)',
                  border: '1px solid rgba(0,212,255,0.3)', borderRadius: 'var(--shape-full)',
                  color: 'var(--cyan)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                ↓ Baixar PDF
              </a>
            )}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                Link de verificação pública (destino do QR Code)
              </div>
              <code className="mono" style={{ fontSize: 12, color: 'var(--text-2)', wordBreak: 'break-all' }}>{verifyUrl}</code>
            </div>
          </>
        )}
        {!isSigned && (
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Laudo ainda em rascunho — assine pra gerar hash, link de verificação e liberar download.
          </span>
        )}
      </div>
    </>
  )
}
