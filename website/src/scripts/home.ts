import type { PropertyDto } from '@dune/contracts'

import { listProperties } from '../lib/api'
import { cardHtml } from '../lib/card'
import { metaByKey, type DirectionKey } from '../lib/directions'
import { formatRub } from '../lib/format'
import { refreshFavorites } from './favorites'
import { initReveal } from './ui'

// Featured pool embedded server-side; tabs filter it client-side (no refetch),
// matching the prototype's behaviour.
function readPool(): PropertyDto[] {
  const el = document.getElementById('featured-data')
  if (!el?.textContent) return []
  try {
    return JSON.parse(el.textContent) as PropertyDto[]
  } catch {
    return []
  }
}

function initFeatured(): void {
  const grid = document.getElementById('featGrid')
  const tabs = document.getElementById('featTabs')
  if (!grid || !tabs) return
  const pool = readPool()

  function render(filter: string): void {
    const dirMap: Record<string, PropertyDto['direction'] | undefined> = {
      new: 'NEW',
      dubai: 'DUBAI',
      saudi: 'SAUDI',
    }
    const target = dirMap[filter]
    const list = (target ? pool.filter((p) => p.direction === target) : pool).slice(0, 6)
    grid!.innerHTML = list.map((p) => cardHtml(p)).join('')
    initReveal(grid!)
    grid!.querySelectorAll<HTMLElement>('.fade-up').forEach((e) => e.classList.add('in'))
    refreshFavorites()
  }

  tabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.tabs__btn')
    if (!btn) return
    tabs.querySelectorAll('.tabs__btn').forEach((x) => x.classList.remove('is-active'))
    btn.classList.add('is-active')
    render(btn.getAttribute('data-f') ?? 'all')
  })
}

function initSearch(): void {
  const form = document.getElementById('searchForm') as HTMLFormElement | null
  const tabsHost = document.querySelector<HTMLElement>('.search__tabs')
  const countEl = document.getElementById('searchCount')
  const cityEl = document.getElementById('f-city') as HTMLSelectElement | null
  const priceFields = Array.from(document.querySelectorAll<HTMLElement>('[data-price-field]'))
  if (!form || !tabsHost) return

  let current: DirectionKey = 'new'

  async function updateCount(): Promise<void> {
    if (!countEl) return
    const meta = metaByKey(current)
    if (!meta) return
    const { total } = await listProperties({ direction: meta.direction, limit: 1 })
    countEl.textContent = `${total} объектов`
  }

  function applyDirection(key: DirectionKey): void {
    current = key
    const meta = metaByKey(key)
    if (cityEl && meta) cityEl.value = meta.city
    // Price filter is per-direction currency (§14 decision): the ₽ selects only
    // apply to RF directions; disable them for Dubai/Saudi.
    const rub = meta?.currency === 'RUB'
    priceFields.forEach((f) => {
      f.style.opacity = rub ? '' : '0.45'
      f.querySelectorAll<HTMLSelectElement>('select').forEach((s) => {
        s.disabled = !rub
        if (!rub) s.value = ''
      })
    })
    void updateCount()
  }

  tabsHost.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('.search__tab')
    if (!tab) return
    tabsHost.querySelectorAll('.search__tab').forEach((x) => x.classList.remove('is-active'))
    tab.classList.add('is-active')
    applyDirection((tab.getAttribute('data-dir') as DirectionKey) ?? 'new')
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    params.set('dir', current)
    const rooms = (document.getElementById('f-rooms') as HTMLSelectElement | null)?.value
    const pmin = (document.getElementById('f-pmin') as HTMLSelectElement | null)?.value
    const pmax = (document.getElementById('f-pmax') as HTMLSelectElement | null)?.value
    if (rooms) params.set('rooms', rooms)
    const meta = metaByKey(current)
    if (meta?.currency === 'RUB') {
      if (pmin) params.set('minPrice', pmin)
      if (pmax && Number(pmax) < 900_000_000) params.set('maxPrice', pmax)
    }
    window.location.href = `/catalog?${params.toString()}`
  })

  applyDirection('new')
}

function initCalculator(): void {
  const price = document.getElementById('calcPriceR') as HTMLInputElement | null
  const dp = document.getElementById('calcDpR') as HTMLInputElement | null
  const term = document.getElementById('calcTermR') as HTMLInputElement | null
  if (!price || !dp || !term) return

  function calc(): void {
    const p = +price!.value
    const dpPct = +dp!.value
    const months = +term!.value
    const down = (p * dpPct) / 100
    const monthly = (p - down) / months
    setText('calcPrice', formatRub(p))
    setText('calcDpLab', `${dpPct}% (${formatRub(down)})`)
    setText('calcTermLab', `${months} мес.`)
    setText('calcResult', formatRub(monthly))
  }
  ;[price, dp, term].forEach((el) => el.addEventListener('input', calc))
  calc()
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

export function initHome(): void {
  initFeatured()
  initSearch()
  initCalculator()
}
