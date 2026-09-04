'use client'

/**
 * Leitor de código de barras via câmera, sem dependência externa.
 *
 * Usa a `BarcodeDetector` API nativa (Chrome/Edge/Android; Safari 17+ parcial).
 * Onde não existe, ou onde a câmera falha (permissão negada, sem dispositivo),
 * degrada para uma mensagem e o usuário digita o código — nunca quebra a tela.
 *
 * Etiquetas de campo (Code128) carregam só os dígitos (`0001`); o prefixo
 * `NEBIM` está apenas impresso. `normalizeCode` reconstrói o código completo.
 */

import { useEffect, useRef, useState } from 'react'

declare global {
  interface BarcodeDetectorResult {
    rawValue: string
  }
  interface BarcodeDetectorInstance {
    detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>
  }
  interface BarcodeDetectorConstructor {
    new (options?: { formats?: string[] }): BarcodeDetectorInstance
    getSupportedFormats(): Promise<string[]>
  }
  // eslint-disable-next-line no-var
  var BarcodeDetector: BarcodeDetectorConstructor | undefined
}

export const CODE_PREFIX = 'NEBIM'

/**
 * `0001` → `NEBIM0001`; `12` → `NEBIM0012`; `INO-S07` → `INO-S07` (inalterado).
 */
export function normalizeCode(raw: string): string {
  const value = raw.trim()
  if (/^\d+$/.test(value)) return `${CODE_PREFIX}${value.padStart(4, '0')}`
  return value
}

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
  formats?: string[]
}

const UNAVAILABLE_MSG = 'Leitura por câmera não disponível neste navegador — digite o código'

export function BarcodeScanner({ onScan, onClose, formats = ['code_128'] }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isBarcodeDetectorSupported() || !navigator.mediaDevices?.getUserMedia) {
      setError(UNAVAILABLE_MSG)
      return
    }

    let stream: MediaStream | null = null
    let raf = 0
    let done = false
    let detecting = false

    const stop = () => {
      done = true
      if (raf) cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }

    const start = async () => {
      let detector: BarcodeDetectorInstance
      try {
        detector = new window.BarcodeDetector!({ formats })
      } catch {
        setError(UNAVAILABLE_MSG)
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
      } catch {
        setError(UNAVAILABLE_MSG)
        return
      }
      if (done) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        /* autoplay pode ser bloqueado; o loop segue esperando readyState */
      }
      setReady(true)

      const tick = async () => {
        if (done) return
        if (video.readyState >= 2 && !detecting) {
          detecting = true
          try {
            const results = await detector.detect(video)
            const hit = results.find((r) => r.rawValue)
            if (hit && !done) {
              stop()
              onScanRef.current(normalizeCode(hit.rawValue))
              return
            }
          } catch {
            /* frame inválido — tenta o próximo */
          } finally {
            detecting = false
          }
        }
        if (!done) raf = requestAnimationFrame(() => void tick())
      }
      raf = requestAnimationFrame(() => void tick())
    }

    void start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leitor de código de barras"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--shape-sm)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.03em' }}>
          LER CÓDIGO DE BARRAS
        </div>

        {error ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{error}</p>
        ) : (
          <>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4 / 3',
                background: '#000',
                borderRadius: 'var(--shape-sm)',
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '10%',
                  right: '10%',
                  top: '40%',
                  height: '20%',
                  border: '2px solid var(--cyan)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                }}
              />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
              {ready ? 'Aponte a câmera para a etiqueta.' : 'Abrindo câmera…'}
            </p>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--shape-sm)',
              color: 'var(--text)',
              fontSize: 13,
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            {error ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner
