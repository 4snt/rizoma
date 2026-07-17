import { test, expect } from '@playwright/test'

/**
 * Smoke E2E — fluxo não autenticado (roda sem login Google).
 * Requer o app no ar (npm run dev) ou BASE_URL apontando para produção.
 */

test('raiz sem sessão redireciona para /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('página de login renderiza entrada Google', async ({ page }) => {
  await page.goto('/login')
  // botão/again link de login com Google
  await expect(page.getByText(/google/i)).toBeVisible()
})

test('rota protegida /metagenomics exige autenticação', async ({ page }) => {
  await page.goto('/metagenomics')
  await expect(page).toHaveURL(/\/login/)
})

// Cobre o middleware de proteção em várias rotas de uma vez.
for (const rota of ['/projects', '/jobs', '/analysis/qualquer', '/admin/users']) {
  test(`rota protegida ${rota} redireciona para /login sem sessão`, async ({ page }) => {
    await page.goto(rota)
    await expect(page).toHaveURL(/\/login/)
  })
}

test('/admin sem sessão não vaza conteúdo administrativo', async ({ page }) => {
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/login/)
  // Garante que nada de "Convidar/Usuários" apareceu antes do redirect.
  await expect(page.getByText(/convidar/i)).toHaveCount(0)
})

/**
 * Fluxo autenticado (cadastro → upload → DADA2 → tabela): depende de login
 * Google, então fica documentado e desabilitado por padrão. Para rodar,
 * injete uma sessão de teste (storageState) e remova o .skip.
 */
test.describe('fluxo autenticado (requer sessão de teste)', () => {
  test.skip('cadastra projeto, roda DADA2 e vê a tabela de ASVs', async () => {
    // 1. /metagenomics → aba Projeto → ⊕ Novo Projeto → preenche e cria
    // 2. Upload de FASTQs (pasta) → pares detectados
    // 3. Aba DADA2 → checklist verde → ▶ Rodar DADA2 → barra de progresso
    // 4. Aba Gráficos → tabela de abundância populada
  })
})
