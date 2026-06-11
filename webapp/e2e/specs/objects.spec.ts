import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'

const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:3000'

// Stage 5.1 — critical path: an admin creates and publishes an object, and it
// becomes visible on the public catalog API (the storefront's data source).
test('admin creates and publishes an object that becomes publicly visible', async ({
  page,
  request,
}) => {
  const email = uniqueEmail()
  const slug = `e2e-villa-${Date.now()}`
  const title = `E2E Вилла ${Date.now()}`

  // Public catalog must not show the object before it exists / is published.
  const before = await request.get(`${backendUrl}/api/properties/${slug}`)
  expect(before.status()).toBe(404)

  const registerResponse = await request.post(`${backendUrl}/api/auth/register`, {
    data: { email, password: e2ePassword, displayName: 'Admin E2E' },
  })
  expect(registerResponse.ok()).toBe(true)

  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(e2ePassword)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Объекты' })).toBeVisible()

  await page.getByRole('link', { name: 'Создать объект' }).click()
  await expect(page.getByRole('heading', { name: 'Новый объект' })).toBeVisible()

  await page.getByLabel('Заголовок').fill(title)
  await page.getByLabel('Slug (URL)').fill(slug)
  await page.getByLabel('Направление').selectOption({ label: 'Новостройки РФ' })
  await page.getByLabel('Тип').selectOption({ label: 'Квартира' })
  await page.getByLabel('Статус публикации').selectOption({ label: 'Опубликовано' })
  await page.getByLabel('Город').fill('Грозный')
  await page.getByLabel(/Цена/).fill('7680000')
  await page.getByLabel(/Площадь/).fill('64')

  await page.getByRole('button', { name: 'Создать объект' }).click()

  // On success the editor opens for the new object (toast + redirect to /objects/:id).
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // The published object is now served by the public catalog API.
  await expect
    .poll(async () => (await request.get(`${backendUrl}/api/properties/${slug}`)).status())
    .toBe(200)

  const published = await request.get(`${backendUrl}/api/properties/${slug}`)
  const body = await published.json()
  expect(body.property.title).toBe(title)
  expect(body.property.status).toBe('PUBLISHED')
  expect(body.property.direction).toBe('NEW')
})
