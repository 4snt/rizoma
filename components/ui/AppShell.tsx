'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'
import { Footer } from '@/components/ui/Footer'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  // /verify é o destino público do QR Code do laudo — sem sidebar/nav
  // interna, quem escaneia não é usuário do Rizoma.
  const isPublicPage = isLoginPage || pathname?.startsWith('/verify')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fecha sidebar ao navegar
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Bloqueia scroll do body quando sidebar aberta em mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  if (isPublicPage) return <>{children}</>

  return (
    <div className="shell">
      {/* Backdrop para fechar sidebar em mobile */}
      <div
        className={`sidebar-overlay${sidebarOpen ? '' : ' hidden'}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Top bar com hambúrguer — só aparece em mobile via CSS */}
        <div className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Abrir menu"
          >
            <span />
            <span />
            <span />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>
            🧬 Rizoma
          </span>
        </div>

        <main className="main-content" style={{ flex: 1 }}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}
