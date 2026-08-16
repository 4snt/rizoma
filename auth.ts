import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const API = process.env.API_URL ?? "http://localhost:8000"
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "@ufvjm.edu.br"
const ALLOWED_HD = ALLOWED_DOMAIN.replace("@", "")

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { hd: ALLOWED_HD, prompt: "select_account" } },
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname
      const isPublic = path.startsWith("/login") || path.startsWith("/api/auth") || path.startsWith("/auth/popup-callback") || path.startsWith("/auth/popup-start")
      if (!session && !isPublic) return false
      if (path.startsWith("/admin") && (session as any)?.role !== "admin") {
        return Response.redirect(new URL("/", request.url))
      }
      return true
    },
    async signIn({ profile }) {
      return !!profile?.email?.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase())
    },
    async jwt({ token, account }) {
      if (account?.access_token) {
        // /api/v1/auth/* nunca é montado pelo backend (fala com schema antigo,
        // ver app/main.py) — o endpoint real é /api/v2/identity/auth/google,
        // que devolve {access_token, user: {...}, organizations: [...]}.
        const res = await fetch(`${API}/api/v2/identity/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: account.access_token }),
        })
        if (res.ok) {
          const data = await res.json()
          token.accessToken = data.access_token
          token.role        = data.organizations?.[0]?.role ?? "viewer"
          token.userEmail   = data.user.email
          token.userName    = data.user.name
        } else {
          token.error = res.status === 403 ? "NotInvited" : "AuthError"
        }
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
