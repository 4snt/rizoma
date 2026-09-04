import { redirect } from 'next/navigation'

// "Projetos v2" foi unificado em /projects. Redirect mantido para links antigos.
export default function ProjectsV2RedirectPage() {
  redirect('/projects')
}
