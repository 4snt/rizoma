'use client'

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"
import Image from "next/image"

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null

  const messages: Record<string, string> = {
    NotInvited:   "Seu email não foi autorizado. Contacte o administrador.",
    AccessDenied: "Email não pertence ao domínio da universidade.",
    AuthError:    "Erro de autenticação. Tente novamente.",
  }

  const msg = messages[error] ?? "Erro desconhecido. Tente novamente."

  return (
    <div style={{
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 13,
      color: "var(--red)",
      lineHeight: 1.5,
      textAlign: "center",
    }}>
      {msg}
    </div>
  )
}

function LoginContent() {
  const params    = useSearchParams()
  const error     = params.get("error")
  const popupRef  = useRef<Window | null>(null)

  // Escuta o aviso do popup de login (ver app/auth/popup-callback)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "rizoma-auth-complete") return
      window.location.href = "/"
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const handleSignIn = () => {
    const width  = 500
    const height = 650
    const left   = window.screenX + (window.outerWidth - width) / 2
    const top    = window.screenY + (window.outerHeight - height) / 2
    const callbackUrl = encodeURIComponent(`${window.location.origin}/auth/popup-callback`)

    popupRef.current = window.open(
      `/auth/popup-start?callbackUrl=${callbackUrl}`,
      "rizoma-login",
      `width=${width},height=${height},left=${left},top=${top}`
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid rgba(0,212,255,0.18)",
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 380,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        boxShadow: "0 0 40px rgba(0,212,255,0.05)",
      }}>
        {/* Logo / header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🧬</div>
          <div
            className="glow-cyan"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--cyan)",
              letterSpacing: "-0.01em",
            }}
          >
            Rizoma
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            Bioinformática · UFVJM
          </div>
          <div style={{
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 6,
            lineHeight: 1.5,
          }}>
            Universidade Federal dos<br />
            Vales do Jequitinhonha e Mucuri
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Error message */}
        <ErrorMessage error={error} />

        {/* Google sign-in button */}
        <button
          onClick={handleSignIn}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "100%",
            padding: "11px 20px",
            background: "#ffffff",
            color: "#1f1f1f",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "box-shadow 150ms ease, opacity 150ms ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.18)")}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
        >
          {/* Google "G" SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Entrar com Google
        </button>

        {/* Domain restriction note */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            Acesso restrito a emails
          </div>
          <div
            className="mono"
            style={{ color: "var(--cyan)", fontSize: 12, marginTop: 2 }}
          >
            @ufvjm.edu.br
          </div>
        </div>

        {/* Institution logos */}
        <div style={{ height: 1, background: "var(--border)" }} />
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <Image
            src="/logo_decom.png"
            alt="DECOM"
            width={80}
            height={32}
            style={{ objectFit: "contain", opacity: 0.8 }}
          />
          <div style={{
            background: "#ffffff",
            borderRadius: 8,
            padding: "4px 6px",
            border: "1px solid rgba(0,0,0,0.06)",
          }}>
            <Image
              src="/logo_nebim.jpg"
              alt="NEBIM"
              width={80}
              height={80}
              style={{ objectFit: "contain", display: "block" }}
            />
          </div>
          <Image
            src="/logo_inovaherb.png"
            alt="INOVAHERB"
            width={85}
            height={32}
            style={{ objectFit: "contain", opacity: 0.8 }}
          />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
