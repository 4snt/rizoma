import { redirect } from 'next/navigation'

/**
 * Rota legada — o módulo de metagenômica foi unificado no hub /metagenomics.
 * Mantida apenas como redirect para não quebrar links/bookmarks antigos.
 */
export default function LegacyMetagenomicsPage() {
  redirect('/metagenomics')
}
