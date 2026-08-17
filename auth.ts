import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const API = process.env.API_URL ?? "http://localhost:8000"
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "@ufvjm.edu.br"
const ALLOWED_HD = ALLOWED_DOMAIN.replace("@", "")

// Margem de segurança antes do vencimento real: renova um pouco antes de
// 0s restantes, pra uma requisição em voo não pegar o token expirando no
// meio do caminho.
const REFRESH_SKEW_MS = 60_000

/** Lê o `exp` (segundos, epoch) de um JWT sem verificar assinatura — só
 * pra saber quando renovar; a verificação de verdade é sempre no backend. */
function jwtExpiresAtMs(jwt: string): number {
  const payload = jwt.split(".")[1]
  const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  return (json.exp as number) * 1000
}

/** Troca o access_token do backend por um novo, repetindo o mesmo handshake
 * do login inicial — mas com um access_token do Google já renovado via
 * refresh_token, sem o usuário precisar clicar em nada. */
async function loginWithBackend(googleAccessToken: string) {
  const res = await fetch(`${API}/api/v2/identity/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: googleAccessToken }),
  })
  if (!res.ok) {
    throw new Error(res.status === 403 ? "NotInvited" : "AuthError")
  }
  return res.json() as Promise<{
    access_token: string
    user: { email: string; name: string }
    organizations: { role: string }[]
  }>
}

/** Troca o refresh_token do Google por um access_token do Google novo.
 * Exige que o provider tenha pedido access_type=offline + prompt=consent
 * na primeira autorização — sem isso o Google nunca manda refresh_token. */
async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error("GoogleRefreshFailed")
  const data = await res.json()
  return data.access_token as string
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // access_type=offline + prompt inclui "consent": sem os dois juntos
      // o Google só manda refresh_token na primeiríssima autorização da
      // conta pro app, nunca de novo — e sem refresh_token o token do
      // backend (60min, ver app/core/config.py jwt_access_minutes) expira
      // pra sempre depois da primeira hora de sessão, sem chance de renovar
      // silenciosamente (era exatamente o bug: sessão do NextAuth parecia
      // viva, mas todo request na API dava 401 depois de 1h).
      authorization: {
        params: { hd: ALLOWED_HD, prompt: "select_account consent", access_type: "offline" },
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname
      // /verify é o destino do QR Code impresso no laudo — quem escaneia não
      // tem conta nenhuma no Rizoma, precisa ficar público (backend também
      // expõe /api/v2/reports/{id}/verify sem auth, de propósito).
      const isPublic = path.startsWith("/login") || path.startsWith("/api/auth") || path.startsWith("/auth/popup-callback") || path.startsWith("/auth/popup-start") || path.startsWith("/verify")
      if (!session && !isPublic) return false
      // Papel real do backend é "org_admin" (app/shared/context.py
      // PERMISSIONS), nunca "admin" sozinho — comparar com "admin" nunca
      // batia pra ninguém real, /admin/* ficava inacessível até pra quem
      // era org_admin de verdade.
      if (path.startsWith("/admin") && (session as any)?.role !== "org_admin") {
        return Response.redirect(new URL("/", request.url))
      }
      return true
    },
    async signIn({ profile }) {
      return !!profile?.email?.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase())
    },
    async jwt({ token, account }) {
      // Login inicial: `account` só vem preenchido nesta primeira chamada,
      // logo depois do OAuth completar.
      if (account?.access_token) {
        try {
          const data = await loginWithBackend(account.access_token)
          token.accessToken = data.access_token
          token.accessTokenExpires = jwtExpiresAtMs(data.access_token)
          token.role = data.organizations?.[0]?.role ?? "viewer"
          token.userEmail = data.user.email
          token.userName = data.user.name
          token.googleRefreshToken = account.refresh_token
          delete token.error
        } catch (e) {
          token.error = e instanceof Error ? e.message : "AuthError"
        }
        return token
      }

      // Chamadas seguintes: token do backend ainda válido, nada a fazer.
      const expires = token.accessTokenExpires as number | undefined
      if (expires && Date.now() < expires - REFRESH_SKEW_MS) {
        return token
      }

      // Token do backend venceu (ou nunca teve validade registrada, sessão
      // de antes desta mudança) — tenta renovar em silêncio via refresh_token
      // do Google. Sem refresh_token guardado, não tem como renovar: força
      // login de novo em vez de deixar a sessão morta por mais uma hora.
      const refreshToken = token.googleRefreshToken as string | undefined
      if (!refreshToken) {
        token.error = "RefreshTokenMissing"
        return token
      }
      try {
        const googleAccessToken = await refreshGoogleAccessToken(refreshToken)
        const data = await loginWithBackend(googleAccessToken)
        token.accessToken = data.access_token
        token.accessTokenExpires = jwtExpiresAtMs(data.access_token)
        token.role = data.organizations?.[0]?.role ?? "viewer"
        token.userEmail = data.user.email
        token.userName = data.user.name
        delete token.error
      } catch (e) {
        token.error = e instanceof Error ? e.message : "RefreshFailed"
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.role        = token.role as string
      session.error       = token.error as string | undefined
      session.userEmail   = token.userEmail as string
      session.userName    = token.userName as string
      // token.picture is populated by NextAuth from Google profile automatically
      session.userPicture = (token.picture as string | undefined) ?? null
      return session
    },
  },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
})
