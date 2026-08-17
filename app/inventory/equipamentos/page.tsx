'use client'

import { useSession } from 'next-auth/react'
import { AlertsPanel, EquipmentSection } from '@/components/inventory/InventorySections'

export default function EquipamentosPage() {
  const { data: session } = useSession()
  const token = session?.accessToken
  const role = session?.role

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Equipamentos</h1>
        <p className="page-subtitle">Cadastro, status e calibração</p>
      </div>

      {token && <AlertsPanel token={token} />}
      {token && <EquipmentSection token={token} role={role} />}
    </>
  )
}
