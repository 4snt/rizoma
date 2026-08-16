'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'

function VerifyContent() {
  const params = useParams()
  const id = params?.id as string
  const search = useSearchParams()
  const hash = search.get('hash') ?? undefined

  const { data, error, isLoading } = useSWR(
    id ? ['verify', id, hash] : null,
    () => api.verifyReport(id, hash),
  )

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--shape-md)', padding: '40px 36px', width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32 }}>🧬</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cyan)' }}>Rizoma · Verificação de Laudo</div>

        {isLoading && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Verificando...</div>}

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red)' }}>Erro ao verificar este laudo.</div>
        )}

        {data && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700,
              color: data.valid ? 'var(--green)' : 'var(--red)',
            }}>
              {data.valid ? '✓ Documento autêntico' : '✗ Documento inválido'}
            </div>
            {data.valid ? (
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                {data.code && <div><span className="mono">{data.code}</span> · v{data.version}</div>}
                {data.project && <div>{data.project}</div>}
                {data.organization && <div>{data.organization}</div>}
                {data.signed_at && <div>Assinado em {new Date(data.signed_at).toLocaleString('pt-BR')}</div>}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{data.detail ?? 'Este documento não pôde ser confirmado.'}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}
