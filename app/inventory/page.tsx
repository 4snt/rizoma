// /inventory virou 2 telas (Reagentes e Equipamentos) na reorganização da
// sidebar em seções básicas de LIMS — redirect pra manter link antigo vivo.
import { redirect } from 'next/navigation'

export default function InventoryPage() {
  redirect('/inventory/reagentes')
}
