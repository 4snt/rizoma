'use client'

import { useSession } from 'next-auth/react'
import { AlertsPanel, ReagentsSection } from '@/components/inventory/InventorySections'

export default function ReagentesPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const role = session?.role

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Reagentes</h1>
        <p className="page-subtitle">Cadastro, lotes e consumo</p>
      </div>

      {token && <AlertsPanel token={token} />}
      {token && <ReagentsSection token={token} role={role} />}
    </>
  )
}
