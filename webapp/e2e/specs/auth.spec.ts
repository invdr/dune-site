import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'

const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

// The admin webapp has no public registration (§10): a single shared account is
// provisioned out of band. We seed one through the API, then drive the login UI.
test('logs in, restores the session across reload, navigates, and logs out', async ({
  page,
  request,
}) => {
  const email = uniqueEmail()

  const registerResponse = await request.post(`${backendUrl}/api/auth/register`, {
    data: { email, password: e2ePassword, displayName: 'Admin E2E' },
  })
  expect(registerResponse.ok()).toBe(true)

  await page.goto('/')

  // Unauthenticated visitors only ever see the login screen, on any route.
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.getByRole('button', { name: 'Войти' }).click()

  // Logged in → the objects catalog is the dashboard entry point.
  await expect(page.getByRole('heading', { name: 'Объекты' })).toBeVisible()

  await expect
    .poll(async () =>
      (await page.context().cookies()).some(
        (cookie) => cookie.name === 'web_app_demo_refresh' && cookie.httpOnly,
      ),
    )
    .toBe(true)

  const refreshAfterReload = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/refresh') && response.request().method() === 'POST',
  )

  await page.reload()

  await expect((await refreshAfterReload).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Объекты' })).toBeVisible()

  // Protected navigation works without re-authenticating.
  await page.getByRole('link', { name: 'Заявки' }).click()
  await expect(page.getByRole('heading', { name: 'Заявки' })).toBeVisible()

  await page.getByRole('button', { name: 'Выйти' }).first().click()
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()
})
