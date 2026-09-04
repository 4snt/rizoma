import { redirect } from 'next/navigation'

// Rota antiga do cadastro de projeto. O formulário mora em /projects/new;
// isto só existe para não quebrar bookmark/link antigo.
export default function LegacyNewProjectPage() {
  redirect('/projects/new')
}
