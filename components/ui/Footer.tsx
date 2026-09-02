import Image from 'next/image'
import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
      background: 'var(--surface)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}>
      <Image
        src="/logo_decom.png"
        alt="DECOM — Departamento de Computação UFVJM"
        width={80}
        height={32}
        style={{ objectFit: 'contain', opacity: 0.8, maxWidth: '25vw', height: 'auto' }}
      />
      <Image
        src="/logo_nebim.svg"
        alt="NEBIM"
        width={100}
        height={32}
        style={{ objectFit: 'contain', opacity: 0.8, maxWidth: '28vw', height: 'auto' }}
      />
      <Image
        src="/logo_inovaherb.png"
        alt="INOVAHERB"
        width={90}
        height={32}
        style={{ objectFit: 'contain', opacity: 0.8, maxWidth: '25vw', height: 'auto' }}
      />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/privacidade" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Política de Privacidade
        </Link>
        <Link href="/termos" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Termos de Serviço
        </Link>
      </div>
    </footer>
  )
}
