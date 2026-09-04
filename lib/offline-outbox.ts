/**
 * Outbox de mutações offline (§6 da arquitetura v2).
 *
 * O técnico de campo registra amostras numa fazenda sem sinal. Cada mutação:
 *   1. gera UUIDv7 no cliente (o ID da entidade — criação nunca conflita)
 *   2. gera um Idempotency-Key (reenvio seguro: a API devolve o mesmo resultado)
 *   3. é aplicada otimisticamente na UI
 *   4. é enfileirada na outbox (IndexedDB, via idb-keyval)
 *
 * Ao voltar a rede (evento `online` / reconnect do TanStack Query), a fila é reenviada.
 *
 * Escopo deliberado (§6): só o CAMPO é offline. Resultado de laboratório NÃO pode
 * ser criado offline — o laboratório tem internet, e isso corta metade da complexidade.
 */

import { get, set } from 'idb-keyval'
import { apiV2Client, ApiV2Error, type CreateSampleInput, type SampleV2 } from '@/lib/api-v2'

const OUTBOX_KEY = 'rizoma.outbox.v1'

/* ── UUIDv7 ─────────────────────────────────────────────────────────── */

/**
 * UUIDv7: 48 bits de timestamp (ms) + versão 7 + aleatório.
 * Ordenável no tempo — o que faz dele uma PK decente e um ID de cliente seguro.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // 48 bits de timestamp em ms. Date.now() cabe num Number com folga (< 2^53),
  // então usamos aritmética comum em vez de BigInt (que exige target ES2020+).
  let ts = Date.now()
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts & 0xff
    ts = Math.floor(ts / 256)
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70 // versão 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/* ── Entradas da fila ───────────────────────────────────────────────── */

export interface CreateSampleOperation {
  type: 'sample.create'
  projectId: string
  input: CreateSampleInput & { id: string }
  /**
   * @deprecated Observações agora vão em `input.notes` (a API aceita o campo).
   * Mantido só para entradas antigas já persistidas na outbox — `send()` faz o merge.
   */
  notes?: string
}

/** União aberta a novas operações de campo (foto vai por fora — ver §6). */
export type OutboxOperation = CreateSampleOperation

export interface OutboxEntry {
  /** UUIDv7 da entrada — também é o Idempotency-Key enviado à API. */
  id: string
  operation: OutboxOperation
  organizationId: string | null
  createdAt: string
  attempts: number
  lastError?: string
}

/* ── Persistência (IndexedDB) ───────────────────────────────────────── */

type Listener = (entries: OutboxEntry[]) => void
const listeners = new Set<Listener>()

async function readAll(): Promise<OutboxEntry[]> {
  const stored = await get<OutboxEntry[]>(OUTBOX_KEY)
  return stored ?? []
}

async function writeAll(entries: OutboxEntry[]): Promise<void> {
  await set(OUTBOX_KEY, entries)
  listeners.forEach((listener) => listener(entries))
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener)
  void readAll().then(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  return readAll()
}

export async function outboxCount(): Promise<number> {
  return (await readAll()).length
}

export async function enqueue(
  operation: OutboxOperation,
  organizationId: string | null
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    id: uuidv7(),
    operation,
    organizationId,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  const entries = await readAll()
  await writeAll([...entries, entry])
  return entry
}

export async function removeEntry(id: string): Promise<void> {
  const entries = await readAll()
  await writeAll(entries.filter((e) => e.id !== id))
}

export async function clearOutbox(): Promise<void> {
  await writeAll([])
}

/* ── Envio ──────────────────────────────────────────────────────────── */

async function send(entry: OutboxEntry): Promise<SampleV2> {
  const op = entry.operation
  switch (op.type) {
    case 'sample.create':
      // O Idempotency-Key faz o reenvio ser seguro: a API devolve o mesmo resultado.
      // Compat: entradas antigas guardavam `notes` fora do input.
      return apiV2Client.createSample(
        op.projectId,
        op.notes && !op.input.notes ? { ...op.input, notes: op.notes } : op.input,
        entry.id
      )
  }
}

export interface FlushResult {
  sent: number
  failed: number
  remaining: number
}

let flushing = false

/**
 * Reenvia a fila inteira. Um erro 4xx (exceto 408/429) é definitivo — a entrada
 * sai da fila para não travar as demais; erro de rede/5xx mantém a entrada.
 */
export async function flushOutbox(): Promise<FlushResult> {
  if (flushing) return { sent: 0, failed: 0, remaining: (await readAll()).length }
  flushing = true
  try {
    let sent = 0
    let failed = 0

    for (const entry of await readAll()) {
      try {
        await send(entry)
        await removeEntry(entry.id)
        sent++
      } catch (err) {
        failed++
        const permanent =
          err instanceof ApiV2Error &&
          err.status >= 400 &&
          err.status < 500 &&
          err.status !== 408 &&
          err.status !== 429
        if (permanent) {
          await removeEntry(entry.id)
        } else {
          const entries = await readAll()
          await writeAll(
            entries.map((e) =>
              e.id === entry.id
                ? { ...e, attempts: e.attempts + 1, lastError: (err as Error).message }
                : e
            )
          )
        }
      }
    }

    return { sent, failed, remaining: (await readAll()).length }
  } finally {
    flushing = false
  }
}

/** Enfileira e — se houver rede — tenta enviar na hora. */
export async function enqueueAndFlush(
  operation: OutboxOperation,
  organizationId: string | null
): Promise<OutboxEntry> {
  const entry = await enqueue(operation, organizationId)
  if (typeof navigator === 'undefined' || navigator.onLine) {
    void flushOutbox()
  }
  return entry
}

/** Registra o reenvio automático ao voltar a rede. Devolve o cleanup. */
export function startOutboxAutoFlush(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onOnline = () => {
    void flushOutbox()
  }
  window.addEventListener('online', onOnline)
  if (navigator.onLine) void flushOutbox()
  return () => window.removeEventListener('online', onOnline)
}
