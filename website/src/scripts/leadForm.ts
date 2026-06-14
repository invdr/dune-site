import type { CreateLeadRequest, PropertyDirection } from '@dune/contracts'

import { createLead } from '../lib/api'

// Lead capture with inline validation. Consent (152-ФЗ) is mandatory on both
// the frontend and the backend; the honeypot field stays empty for humans and
// is sent as `honeypot` for server-side spam detection. On success the card
// flips to the success panel (CSS `.is-sent`); the API persists the lead first,
// so the success screen reflects a stored lead.
const DIRECTIONS: PropertyDirection[] = ['NEW', 'RESALE', 'DUBAI', 'SAUDI']

function setError(field: HTMLElement, input: HTMLElement, msg: string | null): void {
  let err = field.querySelector<HTMLElement>('.field__err')
  if (msg) {
    if (!err) {
      err = document.createElement('div')
      err.className = 'field__err'
      err.setAttribute('role', 'alert')
      field.appendChild(err)
    }
    err.textContent = msg
    field.classList.add('field--error')
    input.setAttribute('aria-invalid', 'true')
  } else {
    field.classList.remove('field--error')
    input.removeAttribute('aria-invalid')
    if (err) err.remove()
  }
}

function validateInput(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  const field = input.closest<HTMLElement>('.field')
  if (!field) return true
  const value = (input.value || '').trim()
  if (input.hasAttribute('required') && !value) {
    setError(field, input, 'Пожалуйста, заполните это поле')
    return false
  }
  if ((input as HTMLInputElement).type === 'tel' && value && value.replace(/\D/g, '').length < 10) {
    setError(field, input, 'Введите корректный номер телефона')
    return false
  }
  setError(field, input, null)
  return true
}

function bindForm(form: HTMLFormElement): void {
  form.setAttribute('novalidate', '')
  const card = form.closest<HTMLElement>('[data-lead-card]') ?? form
  const source = form.getAttribute('data-source') ?? 'website'
  const lockedDirection = form.getAttribute('data-direction')
  const propertyId = form.getAttribute('data-property-id') ?? undefined

  const fieldInputs = Array.from(
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      '.field input, .field select, .field textarea',
    ),
  )

  fieldInputs.forEach((el) => {
    const ev = el.tagName === 'SELECT' ? 'change' : 'input'
    el.addEventListener(ev, () => {
      const fl = el.closest('.field')
      if (fl?.classList.contains('field--error')) validateInput(el)
    })
    el.addEventListener('blur', () => {
      if ((el.value || '').trim() || el.hasAttribute('required')) validateInput(el)
    })
  })

  const consent = form.querySelector<HTMLInputElement>('input[name="consent"]')
  const consentError = form.querySelector<HTMLElement>('[data-consent-error]')

  function validateConsent(): boolean {
    if (!consent) return true
    const ok = consent.checked
    if (consentError) {
      consentError.textContent = ok ? '' : 'Необходимо согласие на обработку персональных данных'
      consentError.toggleAttribute('hidden', ok)
    }
    return ok
  }
  consent?.addEventListener('change', validateConsent)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    let firstBad: HTMLElement | null = null
    fieldInputs.forEach((el) => {
      if (!validateInput(el) && !firstBad) firstBad = el
    })
    const consentOk = validateConsent()
    if (firstBad) {
      ;(firstBad as HTMLElement).focus()
      return
    }
    if (!consentOk) {
      consent?.focus()
      return
    }

    const data = new FormData(form)
    const directionRaw = (lockedDirection ?? String(data.get('direction') ?? '')).toUpperCase()
    const direction = DIRECTIONS.includes(directionRaw as PropertyDirection)
      ? (directionRaw as PropertyDirection)
      : undefined

    const payload: CreateLeadRequest = {
      name: String(data.get('name') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      email: (String(data.get('email') ?? '').trim() || undefined) as CreateLeadRequest['email'],
      message: (String(data.get('message') ?? '').trim() || undefined) as CreateLeadRequest['message'],
      source,
      direction,
      propertyId: propertyId || undefined,
      consent: true,
      honeypot: String(data.get('company') ?? ''),
    }

    const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, select, textarea, button'))
    controls.forEach((el) => (el.disabled = true))

    const result = await createLead(payload)
    if (result.ok) {
      card.classList.add('is-sent')
      return
    }

    controls.forEach((el) => (el.disabled = false))
    let banner = form.querySelector<HTMLElement>('[data-lead-error]')
    if (!banner) {
      banner = document.createElement('p')
      banner.className = 'field__err'
      banner.setAttribute('data-lead-error', '')
      banner.setAttribute('role', 'alert')
      form.appendChild(banner)
    }
    banner.textContent = result.message
    banner.removeAttribute('hidden')
  })
}

export function initLeadForms(): void {
  document.querySelectorAll<HTMLFormElement>('form[data-lead]').forEach(bindForm)
}
