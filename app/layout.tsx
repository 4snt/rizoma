import type { Metadata } from 'next'
import './globals.css'
import { SessionProviderWrapper } from '@/components/ui/SessionProviderWrapper'
import { AppShell } from '@/components/ui/AppShell'
import { ThemeProvider } from '@/components/ui/ThemeProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { OrgProvider } from '@/components/providers/OrgProvider'

export const metadata: Metadata = {
  title: 'Rizoma',
  description: 'Plataforma de análise de micobioma e transcriptômica — UFVJM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          <SessionProviderWrapper>
            <QueryProvider>
              <OrgProvider>
                <AppShell>
                  {children}
                </AppShell>
              </OrgProvider>
            </QueryProvider>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  )
}
