'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { connectJobStatusSocket } from '@/lib/websocket'

// Vocabulário real de pipeline_jobs.status (ver CHECK constraint na migration).
const STATUS_CONFIG: Record<string, { cls: string; label: string }> = {
  queued:          { cls: 'badge-amber', label: 'queued'          },
  running:         { cls: 'badge-cyan',  label: 'running'         },
  retry_scheduled: { cls: 'badge-amber', label: 'retry scheduled' },
  completed:       { cls: 'badge-green', label: 'completed'       },
  failed:          { cls: 'badge-red',   label: 'failed'          },
  cancelled:       { cls: '',            label: 'cancelled'       },
  dead_letter:     { cls: 'badge-red',   label: 'dead letter'     },
}

interface JobEntry {
  jobId: string
  status: string
  timestamp: Date
  isNew: boolean
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { cls: '', label: status }
  const isRunning = status === 'running'
  return (
    <span className={`badge ${cfg.cls}`}>
      {isRunning && <span className="dot dot-cyan pulse" style={{ width: 6, height: 6 }} />}
      {cfg.label}
    </span>
  )
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function JobsPage() {
  const { data: session } = useSession()
  const [jobs, setJobs] = useState<JobEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [totalReceived, setTotalReceived] = useState(0)
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!session?.accessToken) return

    setConnected(true)
    const disconnect = connectJobStatusSocket(session.accessToken, (jobId, status) => {
      const isNew = !seenRef.current.has(jobId)
      seenRef.current.add(jobId)

      setTotalReceived((n) => n + 1)
      setJobs((prev) => {
        // Update existing row if same jobId
        const idx = prev.findIndex((j) => j.jobId === jobId)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], status, timestamp: new Date(), isNew: false }
          return updated
        }
        // Prepend new row
        return [{ jobId, status, timestamp: new Date(), isNew: true }, ...prev]
      })

      // Clear "new" flag after animation
      setTimeout(() => {
        setJobs((prev) =>
          prev.map((j) => (j.jobId === jobId ? { ...j, isNew: false } : j))
        )
      }, 400)
    })

    return () => {
      disconnect()
      setConnected(false)
    }
  }, [session?.accessToken])

  const runningCount = jobs.filter((j) => j.status === 'running').length

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Fila de Jobs</h1>
            <p className="page-subtitle">Status em tempo real via WebSocket</p>
          </div>
          <div className="flex items-center gap-3">
            {runningCount > 0 && (
              <span className="badge badge-cyan">
                <span className="dot dot-cyan pulse" style={{ width: 6, height: 6 }} />
                {runningCount} running
              </span>
            )}
            {totalReceived > 0 && (
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {totalReceived} recebidos
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {jobs.length > 0 ? (
        <div>
          <div className="jobs-table-header">
            <span>Job ID</span>
            <span>Tipo</span>
            <span>Status</span>
            <span>Horário</span>
          </div>
          <div className="jobs-table">
            {jobs.map((j) => (
              <div key={j.jobId} className={`jobs-row${j.isNew ? ' new-job' : ''}`}>
                <span className="job-id">{j.jobId.slice(0, 8)}…</span>
                <span className="job-type">Pipeline Job</span>
                <StatusBadge status={j.status} />
                <span className="job-time">{formatTime(j.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <span className="empty-state-icon">◌</span>
            <span className="empty-state-title">Aguardando jobs do R Worker...</span>
            <span className="empty-state-desc">
              Quando o pipeline processar amostras, os status aparecem aqui.
            </span>
          </div>
        </div>
      )}

      {/* WS status footer */}
      <div className="ws-status-bar" style={{ marginTop: 24 }}>
        {connected ? (
          <>
            <span className="dot dot-green" style={{ width: 6, height: 6 }} />
            <span>Conectado via WebSocket</span>
          </>
        ) : (
          <>
            <span className="dot dot-red" style={{ width: 6, height: 6 }} />
            <span>Desconectado</span>
          </>
        )}
      </div>
    </>
  )
}
