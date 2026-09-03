import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, apiFetchWithToken } from '@/lib/api'

// Base default do cliente quando NEXT_PUBLIC_API_URL não é definido.
const BASE = 'http://localhost:8000'

function mockFetch(impl: (url: string, init?: RequestInit) => Partial<Response>) {
  const spy = vi.fn((url: string, init?: RequestInit) => {
    const r = impl(url, init)
    return Promise.resolve({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: r.json ?? (() => Promise.resolve({})),
      ...r,
    } as Response)
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('api client', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('getProjects chama o path /api/v2/lims/projects com Bearer e devolve o JSON', async () => {
    const spy = mockFetch(() => ({ json: () => Promise.resolve([{ id: '1' }]) }))
    const out = await api.getProjects('tok-123')
    expect(spy).toHaveBeenCalledWith(`${BASE}/api/v2/lims/projects`, expect.any(Object))
    const init = spy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123')
    expect(out).toEqual([{ id: '1' }])
  })

  it('erro HTTP vira Error com status e path', async () => {
    mockFetch(() => ({ ok: false, status: 500 }))
    await expect(api.getProjects('tok')).rejects.toThrow(/API error 500/)
  })

  it('apiFetchWithToken injeta o Bearer', async () => {
    const spy = mockFetch(() => ({ json: () => Promise.resolve({ ok: true }) }))
    await apiFetchWithToken('/api/v2/identity/me', 'tok-123')
    const init = spy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123')
  })

  it('apiFetchWithToken traduz 401 para Unauthorized', async () => {
    mockFetch(() => ({ ok: false, status: 401 }))
    await expect(apiFetchWithToken('/api/v2/identity/me', 'tok')).rejects.toThrow('Unauthorized')
  })
})
