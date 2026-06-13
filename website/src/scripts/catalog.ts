import type { Country, PropertyCategory } from '@dune/contracts'

import { listProperties } from '../lib/api'
import { cardHtml } from '../lib/card'
import {
  activePills,
  applyTypeOption,
  defaultState,
  headFor,
  parseState,
  priceCurrency,
  toQuery,
  toSearch,
  typeOptionFor,
  type CatalogState,
} from '../lib/catalogState'
import { refreshFavorites } from './favorites'
import { initReveal } from './ui'

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel))

let state: CatalogState
let page = 1
let pageCount = 1
let citiesByCountry: Record<string, string[]> = {}

function populateCities(): void {
  const sel = $<HTMLSelectElement>('#citySel')
  if (!sel) return
  const cities = citiesByCountry[state.country] ?? []
  const opts = ['<option value="">Все города</option>']
  for (const c of cities) {
    const selected = state.city === c ? ' selected' : ''
    opts.push(`<option value="${c}"${selected}>${c}</option>`)
  }
  sel.innerHTML = opts.join('')
  sel.value = state.city ?? ''
}

function syncControls(): void {
  $$('#countryChips .chip').forEach((c) => c.classList.toggle('is-on', state.country === c.getAttribute('data-country')))
  $$('#categoryChips .chip').forEach((c) => c.classList.toggle('is-on', state.category === c.getAttribute('data-cat')))
  const activeType = typeOptionFor(state)?.key ?? null
  $$('#typeChips .chip').forEach((c) => c.classList.toggle('is-on', activeType === c.getAttribute('data-type')))
  $$('#roomChips .chip').forEach((c) => {
    const v = Number(c.getAttribute('data-rooms'))
    const on = v === 4 ? (state.rooms ?? 0) >= 4 : state.rooms === v
    c.classList.toggle('is-on', on)
  })

  populateCities()

  const priceLabel = $('#priceLabel')
  if (priceLabel) priceLabel.textContent = `Цена, ${priceCurrency(state) === 'USD' ? '$' : '₽'}`
  setVal('#pmin', state.minPrice)
  setVal('#pmax', state.maxPrice)
  setVal('#amin', state.minArea)
  setVal('#amax', state.maxArea)

  setChecked('#instToggle', state.installment)
  setChecked('#premToggle', state.premium)
  const sortSel = $<HTMLSelectElement>('#sortSel')
  if (sortSel) sortSel.value = state.sort
}

function setVal(sel: string, value: number | null): void {
  const el = $<HTMLInputElement>(sel)
  if (el) el.value = value == null ? '' : String(value)
}
function setChecked(sel: string, value: boolean): void {
  const el = $<HTMLInputElement>(sel)
  if (el) el.checked = value
}

function renderPills(): void {
  const host = $('#activePills')
  if (!host) return
  const pills = activePills(state)
  host.innerHTML = pills
    .map((p) => `<button class="chip is-on" type="button" data-pill="${p.key}">${p.label} <span style="margin-left:4px;font-weight:700">×</span></button>`)
    .join('')
  host.style.display = pills.length ? 'flex' : 'none'
  host.style.marginBottom = pills.length ? '22px' : '0'
}

function updateHead(): void {
  const head = headFor(state)
  const title = $('#pageTitle')
  const sub = $('#pageSub')
  const crumb = $('#crumbDir')
  if (title) title.innerHTML = head.titleHtml
  if (sub) sub.textContent = head.sub
  if (crumb) crumb.textContent = head.crumb
}

function writeURL(): void {
  const qs = toSearch(state)
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname)
}

function updateShowMore(): void {
  const wrap = $('#showMoreWrap')
  if (wrap) wrap.toggleAttribute('hidden', page >= pageCount)
}

function afterRender(): void {
  const grid = $('#catalogGrid')
  if (grid) {
    initReveal(grid)
    grid.querySelectorAll<HTMLElement>('.fade-up').forEach((e) => e.classList.add('in'))
  }
  refreshFavorites()
}

let requestSeq = 0

async function load(): Promise<void> {
  page = 1
  const seq = ++requestSeq
  const grid = $('#catalogGrid')
  const apply = $('#applyCount')
  const result = await listProperties(toQuery(state, 1))
  if (seq !== requestSeq) return // a newer filter change superseded this one
  pageCount = result.pageCount
  if (grid) grid.innerHTML = result.items.map((p) => cardHtml(p)).join('')
  const count = $('#resultCount')
  if (count) count.textContent = String(result.total)
  if (apply) apply.textContent = `(${result.total})`
  const empty = $('#emptyState')
  if (empty) empty.toggleAttribute('hidden', result.total > 0)
  updateShowMore()
  renderPills()
  updateHead()
  writeURL()
  afterRender()
}

async function loadMore(): Promise<void> {
  const next = page + 1
  const result = await listProperties(toQuery(state, next))
  page = next
  pageCount = result.pageCount
  const grid = $('#catalogGrid')
  if (grid) grid.insertAdjacentHTML('beforeend', result.items.map((p) => cardHtml(p)).join(''))
  updateShowMore()
  afterRender()
}

function bind(): void {
  $('#countryChips')?.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!c) return
    const country = c.getAttribute('data-country') as Country
    // Mandatory single country: switch, never clear.
    if (state.country === country) return
    state.country = country
    // City list and price currency are country-scoped — reset them so the
    // filters stay consistent with the new country.
    state.city = null
    state.minPrice = null
    state.maxPrice = null
    syncControls()
    void load()
  })

  $<HTMLSelectElement>('#citySel')?.addEventListener('change', function () {
    state.city = this.value || null
    void load()
  })

  $('#categoryChips')?.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!c) return
    const cat = c.getAttribute('data-cat') as PropertyCategory
    state.category = state.category === cat ? null : cat
    syncControls()
    void load()
  })

  $('#typeChips')?.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!c) return
    applyTypeOption(state, c.getAttribute('data-type') ?? '')
    syncControls()
    void load()
  })

  $('#roomChips')?.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.chip')
    if (!c) return
    const v = Number(c.getAttribute('data-rooms'))
    const isOn = v === 4 ? (state.rooms ?? 0) >= 4 : state.rooms === v
    state.rooms = isOn ? null : v
    syncControls()
    void load()
  })

  bindNum('#pmin', 'minPrice')
  bindNum('#pmax', 'maxPrice')
  bindNum('#amin', 'minArea')
  bindNum('#amax', 'maxArea')

  bindToggle('#instToggle', 'installment')
  bindToggle('#premToggle', 'premium')

  $<HTMLSelectElement>('#sortSel')?.addEventListener('change', function () {
    state.sort = this.value
    void load()
  })

  $('#activePills')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pill]')
    if (!b) return
    removePill(b.getAttribute('data-pill') ?? '')
    syncControls()
    void load()
  })

  const reset = () => {
    const country = state.country // keep the chosen country, clear refinements
    state = defaultState()
    state.country = country
    syncControls()
    void load()
  }
  $('#resetBtn')?.addEventListener('click', reset)
  $('#resetBtn2')?.addEventListener('click', reset)
  $('#showMore')?.addEventListener('click', () => void loadMore())

  // mobile filter drawer
  const filters = $('#filters')
  $('#openFilters')?.addEventListener('click', () => {
    filters?.classList.add('is-open')
    document.body.style.overflow = 'hidden'
  })
  $$('[data-filters-close]').forEach((b) =>
    b.addEventListener('click', () => {
      filters?.classList.remove('is-open')
      document.body.style.overflow = ''
    }),
  )

  window.addEventListener('popstate', () => {
    state = parseState(new URLSearchParams(location.search))
    syncControls()
    void load()
  })
}

function bindNum(sel: string, key: 'minPrice' | 'maxPrice' | 'minArea' | 'maxArea'): void {
  let timer: ReturnType<typeof setTimeout>
  $<HTMLInputElement>(sel)?.addEventListener('input', function () {
    const v = this.value === '' ? null : Math.max(0, Math.round(Number(this.value)))
    state[key] = Number.isFinite(v as number) ? (v as number | null) : null
    clearTimeout(timer)
    timer = setTimeout(() => void load(), 350)
  })
}

function bindToggle(sel: string, key: 'installment' | 'premium'): void {
  $<HTMLInputElement>(sel)?.addEventListener('change', function () {
    state[key] = this.checked
    void load()
  })
}

function removePill(key: string): void {
  switch (key) {
    // 'country' is intentionally absent: it is mandatory and has no pill.
    case 'city':
      state.city = null
      break
    case 'cat':
      state.category = null
      break
    case 'type':
      state.type = null
      state.isNewBuilding = false
      break
    case 'rooms':
      state.rooms = null
      break
    case 'minPrice':
      state.minPrice = null
      break
    case 'maxPrice':
      state.maxPrice = null
      break
    case 'minArea':
      state.minArea = null
      break
    case 'maxArea':
      state.maxArea = null
      break
    case 'inst':
      state.installment = false
      break
    case 'prem':
      state.premium = false
      break
  }
}

export function initCatalog(): void {
  state = parseState(new URLSearchParams(location.search))
  const main = $('#catalogMain')
  pageCount = Number(main?.getAttribute('data-pagecount') ?? '1') || 1
  page = 1
  try {
    citiesByCountry = JSON.parse($('#citySel')?.getAttribute('data-cities') ?? '{}')
  } catch {
    citiesByCountry = {}
  }
  syncControls()
  bind()
  updateShowMore()
  // SSR already rendered page 1 for this URL — no initial refetch.
}
