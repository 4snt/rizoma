import { redirect } from 'next/navigation'

// "Projetos v2" foi unificado em /projects/[id]. Redirect mantido para links antigos.
export default function ProjectV2RedirectPage({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}`)
}
