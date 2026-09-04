'use client'

import { FileUploadField } from '@/components/files/FileUploadField'

/** Aba "Anexos" da amostra: fotos de colônia, géis, documentos. */
export function SampleFilesPanel({ projectId, sampleId }: { projectId: string; sampleId: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span className="section-title" style={{ margin: 0 }}>Anexos da amostra</span>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <FileUploadField
          projectId={projectId}
          sampleId={sampleId}
          categories={['colony_photo', 'gel_image', 'document', 'other']}
          defaultCategory="colony_photo"
          accept="image/*,.pdf"
        />
      </div>
    </div>
  )
}

export default SampleFilesPanel
