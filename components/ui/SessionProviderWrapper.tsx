'use client'

import { SessionProvider } from 'next-auth/react'

export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  // Sem refetchInterval, useSession() só busca sessão nova no foco da janela
  // — se o usuário fica minutos preenchendo um formulário sem trocar de aba,
  // o token do backend (jwt_access_minutes) pode vencer com a sessão ainda
  // "viva" no client, e qualquer POST/PATCH nesse meio-tempo estoura 401 cru
  // (ver auth.ts REFRESH_SKEW_MS: a renovação silenciosa só roda quando algo
  // pede sessão de novo). 5min garante que o token seja renovado bem antes
  // do vencimento em qualquer tela aberta por muito tempo.
  return <SessionProvider refetchInterval={5 * 60}>{children}</SessionProvider>
}
