'use client'

import { useOrg } from '@/components/providers/OrgProvider'

/**
 * Seletor da organização ativa. Guarda em localStorage, injeta em `X-Organization`
 * e invalida o cache do TanStack ao trocar (é outro tenant — o cache anterior não vale).
 */
export function OrgSwitcher() {
  const { organizations, organizationId, setOrganizationId, isLoading } = useOrg()

  if (isLoading || organizations.length === 0) return null

  const active = organizations.find((o) => o.id === organizationId)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.06em' }}>ORG</span>
      <select
        aria-label="Organização ativa"
        value={organizationId ?? ''}
        onChange={(e) => setOrganizationId(e.target.value)}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          fontSize: 12,
          padding: '5px 8px',
          maxWidth: 220,
        }}
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {active?.role && <span className="badge badge-cyan">{active.role}</span>}
    </div>
  )
}
