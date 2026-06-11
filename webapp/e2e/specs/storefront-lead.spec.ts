import { expect, test } from '../helpers/test'

// Storefront (public Astro site) lead capture — Stage 5.1.
const websiteUrl = process.env.E2E_WEBSITE_URL ?? 'http://127.0.0.1:4321'

test('lead with consent persists and shows the success screen', async ({ page }) => {
  await page.goto(`${websiteUrl}/`)

  await page.locator('#lead-name').first().fill('Тест Заявка')
  await page.locator('#lead-phone').first().fill('+7 999 123-45-67')
  await page.locator('#lead-consent').first().check()

  const leadRequest = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/leads') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Отправить заявку' }).first().click()

  expect((await leadRequest).status()).toBe(201)
  await expect(page.getByText('Заявка отправлена!').first()).toBeVisible()
})

test('lead without consent is blocked on the client and never submitted', async ({ page }) => {
  await page.goto(`${websiteUrl}/`)

  await page.locator('#lead-name').first().fill('Без Согласия')
  await page.locator('#lead-phone').first().fill('+7 999 123-45-67')
  // Intentionally leave the consent checkbox unchecked.

  let leadPosted = false
  page.on('request', (request) => {
    if (request.url().endsWith('/api/leads') && request.method() === 'POST') leadPosted = true
  })

  await page.getByRole('button', { name: 'Отправить заявку' }).first().click()

  await expect(
    page.getByText('Необходимо согласие на обработку персональных данных').first(),
  ).toBeVisible()
  await expect(page.getByText('Заявка отправлена!')).toHaveCount(0)
  expect(leadPosted).toBe(false)
})
