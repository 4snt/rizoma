'use client'

import { useCallback, useEffect, useState } from 'react'

export interface GeoCoords {
  lat: number
  lon: number
  accuracy?: number
}

export interface UseGeolocation {
  coords: GeoCoords | null
  busy: boolean
  error: string | null
  /** Lê o GPS uma vez; resolve com as coordenadas (ou null em erro). */
  read: () => Promise<GeoCoords | null>
  set: (coords: GeoCoords | null) => void
}

/**
 * Leitura pontual do GPS do dispositivo (`getCurrentPosition`, alta precisão,
 * 15 s de timeout, sem cache). Extraído do Modo Campo pra ser reaproveitado
 * nos formulários de amostra.
 */
export function useGeolocation(): UseGeolocation {
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const read = useCallback((): Promise<GeoCoords | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Este dispositivo não expõe geolocalização.')
      return Promise.resolve(null)
    }
    setBusy(true)
    setError(null)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next: GeoCoords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
          setCoords(next)
          setBusy(false)
          resolve(next)
        },
        (err) => {
          setError(err.message)
          setBusy(false)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
      )
    })
  }, [])

  const set = useCallback((next: GeoCoords | null) => {
    setCoords(next)
    setError(null)
  }, [])

  return { coords, busy, error, read, set }
}

export interface GpsValue {
  lat: number | null
  lon: number | null
}

export interface GpsFieldProps {
  value: GpsValue
  onChange: (v: GpsValue) => void
  /** Precisão em metros vinda de fora (ex.: valor já salvo); se omitida usa a da leitura. */
  accuracy?: number | null
  disabled?: boolean
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)',
  color: 'var(--text)', fontSize: 13, padding: '7px 12px', boxSizing: 'border-box',
  fontFamily: 'var(--mono)', width: 150,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4,
}
const ghostButtonStyle: React.CSSProperties = {
  padding: '7px 14px', background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
  borderRadius: 'var(--shape-full)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
}
const clearButtonStyle: React.CSSProperties = {
  padding: '6px 10px', background: 'transparent', border: '1px solid var(--border)',
  borderRadius: 'var(--shape-full)', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer',
}

function parseNumber(raw: string, min: number, max: number): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

/**
 * Latitude/longitude editáveis com botão "usar minha localização".
 * Lat e lon são sempre alterados juntos no `onChange` — a API rejeita só um.
 */
export function GpsField({ value, onChange, accuracy, disabled }: GpsFieldProps) {
  const geo = useGeolocation()
  const [readAccuracy, setReadAccuracy] = useState<number | null>(null)

  // Quando o pai zera o valor (ex.: após salvar), a precisão da leitura não vale mais.
  useEffect(() => {
    if (value.lat == null && value.lon == null) setReadAccuracy(null)
  }, [value.lat, value.lon])

  const shownAccuracy = accuracy ?? readAccuracy
  const hasValue = value.lat != null || value.lon != null

  async function locate() {
    const c = await geo.read()
    if (!c) return
    setReadAccuracy(c.accuracy ?? null)
    onChange({ lat: c.lat, lon: c.lon })
  }

  function clear() {
    geo.set(null)
    setReadAccuracy(null)
    onChange({ lat: null, lon: null })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={locate}
          disabled={disabled || geo.busy}
          style={{ ...ghostButtonStyle, cursor: disabled || geo.busy ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
        >
          {geo.busy ? 'Lendo GPS…' : '⌖ Usar minha localização'}
        </button>
        <div>
          <label style={labelStyle}>Latitude</label>
          <input
            type="number"
            inputMode="decimal"
            min={-90}
            max={90}
            step={0.000001}
            placeholder="−18.123456"
            value={value.lat ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ lat: parseNumber(e.target.value, -90, 90), lon: value.lon })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Longitude</label>
          <input
            type="number"
            inputMode="decimal"
            min={-180}
            max={180}
            step={0.000001}
            placeholder="−43.123456"
            value={value.lon ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ lat: value.lat, lon: parseNumber(e.target.value, -180, 180) })}
            style={inputStyle}
          />
        </div>
        {shownAccuracy != null && hasValue && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', paddingBottom: 8 }}>
            ±{Math.round(shownAccuracy)} m
          </span>
        )}
        {hasValue && !disabled && (
          <button type="button" onClick={clear} style={{ ...clearButtonStyle, marginBottom: 1 }}>
            limpar
          </button>
        )}
      </div>
      {geo.error && <span style={{ color: 'var(--red)', fontSize: 12 }}>{geo.error}</span>}
    </div>
  )
}

export default GpsField
