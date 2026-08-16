'use client'

import { useEffect } from "react"

/**
 * Callback da janela de login popup.
 * NextAuth redireciona pra cá após concluir o OAuth com sucesso.
 * Avisa a janela que abriu o popup (via postMessage) e se fecha.
 * A janela original escuta essa mensagem e faz o refresh da sessão.
 */
export default function PopupCallbackPage() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: "rizoma-auth-complete" }, window.location.origin)
      window.close()
    } else {
      // fallback: não foi aberto como popup, segue fluxo normal
      window.location.replace("/")
    }
  }, [])

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-2)",
      fontSize: 13,
    }}>
      Login concluído, pode fechar essa janela...
    </div>
  )
}
