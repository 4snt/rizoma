'use client'

import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

// swagger-ui-react usa APIs de browser — não pode ser SSR
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function DocsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">API Docs</h1>
        <p className="page-subtitle">
          Documentação interativa — Rizoma API{' '}
          <a
            href={`${API_URL}/api/docs`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--cyan)', fontSize: 12 }}
          >
            abrir em nova aba ↗
          </a>
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
        <SwaggerUI
          url={`${API_URL}/api/openapi.json`}
          docExpansion="list"
          defaultModelsExpandDepth={-1}
          tryItOutEnabled={false}
        />
      </div>
    </>
  )
}
