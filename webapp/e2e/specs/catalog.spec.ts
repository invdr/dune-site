import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'

// Storefront catalog — Stage 5.1: filters/count and deep-linking from the home
// page into a direction catalog. Objects are seeded through the admin API.
const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'
const websiteUrl = process.env.E2E_WEBSITE_URL ?? 'http://127.0.0.1:4321'

async function adminToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const response = await request.post(`${backendUrl}/api/auth/register`, {
    data: { email: uniqueEmail(), password: e2ePassword, displayName: 'Catalog Seeder' },
  })
  expect(response.ok()).toBe(true)
  return (await response.json()).accessToken
}

async function createPublished(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  overrides: Record<string, unknown>,
) {
  const response = await request.post(`${backendUrl}/api/admin/properties`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      direction: 'NEW',
      type: 'APARTMENT',
      status: 'PUBLISHED',
      title: 'Объект',
      area: 60,
      city: 'Грозный',
      price: 6_000_000,
      currency: 'RUB',
      ...overrides,
    },
  })
  expect(response.ok()).toBe(true)
}

test('catalog renders published objects for a direction with a result count', async ({
  page,
  request,
}) => {
  const token = await adminToken(request)
  const stamp = Date.now()
  const titleA = `Каталог А ${stamp}`
  const titleB = `Каталог Б ${stamp}`
  await createPublished(request, token, { slug: `cat-a-${stamp}`, title: titleA })
  await createPublished(request, token, { slug: `cat-b-${stamp}`, title: titleB })

  await page.goto(`${websiteUrl}/catalog?dir=new`)

  await expect(page.getByText(titleA)).toBeVisible()
  await expect(page.getByText(titleB)).toBeVisible()

  const count = Number((await page.locator('#resultCount').first().innerText()).trim())
  expect(count).toBeGreaterThanOrEqual(2)
})

test('home direction tile deep-links into the prefiltered catalog', async ({ page }) => {
  await page.goto(`${websiteUrl}/`)

  await page.locator('a.dir-tile[href*="dir=dubai"]').first().click()

  await expect(page).toHaveURL(/dir=dubai/)
  await expect(page.locator('#resultCount')).toBeVisible()
})
