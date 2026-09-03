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

// Cobre o middleware de proteção em várias rotas de uma vez.
for (const rota of ['/projects', '/samples', '/reports', '/admin/users']) {
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
 * Fluxo autenticado (criar projeto → registrar amostra → cadeia de custódia):
 * depende de login Google, então fica documentado e desabilitado por padrão.
 * Para rodar, injete uma sessão de teste (storageState) e remova o .skip.
 */
test.describe('fluxo autenticado (requer sessão de teste)', () => {
  test.skip('cria projeto, registra amostra e avança a custódia', async () => {
    // 1. /projects → ⊕ Novo Projeto → código, nome, descrição → cria
    // 2. Redireciona para /projects/{id}/samples → ＋ Registrar Amostra
    // 3. /samples/{id} → transição planned → collected
    // 4. Cadeia de custódia mostra o evento com hash íntegro
  })
})
