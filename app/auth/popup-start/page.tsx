'use client'

import { useEffect } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

/**
 * Página intermediária aberta dentro do popup de login.
 * Dispara signIn() via client (POST + CSRF) direto, sem passar
 * pelo redirect pra /login que NextAuth faz em GET /api/auth/signin/*
 * quando `pages.signIn` está customizado (ver auth.ts).
 */
function PopupStartContent() {
  const params = useSearchParams()
  const callbackUrl = params.get("callbackUrl") ?? "/auth/popup-callback"

  useEffect(() => {
    signIn("google", { callbackUrl })
  }, [callbackUrl])

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-2)",
      fontSize: 13,
    }}>
      Abrindo Google...
    </div>
  )
}

export default function PopupStartPage() {
  return (
    <Suspense>
      <PopupStartContent />
    </Suspense>
  )
}
