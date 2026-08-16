const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'

type JobStatusCallback = (jobId: string, status: string) => void

// Token vai na query string: WebSocket nativo do browser não manda
// Authorization header. O endpoint real é /api/v2/jobs/ws/status
// (o /api/v1 nunca é montado pelo backend — ver app/main.py).
export function connectJobStatusSocket(accessToken: string, onUpdate: JobStatusCallback): () => void {
  const ws = new WebSocket(`${WS_URL}/api/v2/jobs/ws/status?token=${encodeURIComponent(accessToken)}`)

  ws.onmessage = (event) => {
    const [prefix, jobId, status] = (event.data as string).split(':')
    if (prefix === 'status' && jobId && status) {
      onUpdate(jobId, status)
    }
  }

  ws.onerror = () => {
    if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
      console.warn('[ws] conexão perdida — tentando reconectar...')
    }
  }

  return () => ws.close()
}
