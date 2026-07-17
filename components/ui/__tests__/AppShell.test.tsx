import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from '@/components/ui/AppShell'

// usePathname controla se a casca (sidebar + footer) aparece.
let pathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

// Sidebar puxa next-auth/swr; substituímos por um marcador.
vi.mock('@/components/ui/Sidebar', () => ({
  default: () => <nav data-testid="sidebar">sidebar</nav>,
}))
vi.mock('@/components/ui/Footer', () => ({
  Footer: () => <footer data-testid="footer">footer</footer>,
}))

describe('AppShell', () => {
  it('em /login mostra só o conteúdo, sem sidebar nem footer', () => {
    pathname = '/login'
    render(
      <AppShell>
        <p>conteúdo de login</p>
      </AppShell>,
    )
    expect(screen.getByText('conteúdo de login')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('footer')).toBeNull()
  })

  it('fora de /login monta a casca completa (sidebar + footer + conteúdo)', () => {
    pathname = '/projects'
    render(
      <AppShell>
        <p>dashboard</p>
      </AppShell>,
    )
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.getByLabelText('Abrir menu')).toBeInTheDocument()
  })
})
