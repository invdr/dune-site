import type { ComplexDetailDto, PropertyDto } from '@dune/contracts'

import { getComplex, getProperty } from '../lib/api'
import { cardHtml } from '../lib/card'
import { complexCardHtml } from '../lib/complexCard'
import { FAVORITES_EVENT, getFavorites, refreshFavorites } from './favorites'
import { initReveal } from './ui'

// Favourites hold both apartments (bare slug) and ЖК (namespaced `zhk:<slug>`).
// Each saved id is resolved to its card markup, preserving the order the user
// saved them. Results are cached so toggling one favourite off just drops its
// card without refetching the rest.
const COMPLEX_PREFIX = 'zhk:'
const cache = new Map<string, string | null>()

async function resolveCard(favId: string): Promise<string | null> {
  if (cache.has(favId)) return cache.get(favId) ?? null
  let markup: string | null = null
  if (favId.startsWith(COMPLEX_PREFIX)) {
    const complex: ComplexDetailDto | null = await getComplex(favId.slice(COMPLEX_PREFIX.length))
    markup = complex ? complexCardHtml(complex, { favorite: true }) : null
  } else {
    const property: PropertyDto | null = await getProperty(favId)
    markup = property ? cardHtml(property, { favorite: true }) : null
  }
  cache.set(favId, markup)
  return markup
}

async function resolve(favIds: string[]): Promise<string[]> {
  const cards = await Promise.all(favIds.map(resolveCard))
  return cards.filter((c): c is string => c !== null)
}

export function initFavoritesPage(): void {
  const grid = document.getElementById('favGrid')
  const empty = document.getElementById('favEmpty')
  const loading = document.getElementById('favLoading')
  if (!grid || !empty || !loading) return

  let rendering = false

  async function render(): Promise<void> {
    if (rendering) return
    rendering = true
    const favIds = getFavorites()
    if (!favIds.length) {
      grid!.hidden = true
      grid!.innerHTML = ''
      loading!.hidden = true
      empty!.hidden = false
      rendering = false
      return
    }
    const cards = await resolve(favIds)
    loading!.hidden = true
    if (!cards.length) {
      grid!.hidden = true
      empty!.hidden = false
      rendering = false
      return
    }
    empty!.hidden = true
    grid!.hidden = false
    grid!.innerHTML = cards.join('')
    initReveal(grid!)
    grid!.querySelectorAll<HTMLElement>('.fade-up').forEach((e) => e.classList.add('in'))
    refreshFavorites()
    rendering = false
  }

  // Re-render when favourites change (e.g. user un-favourites a card here).
  window.addEventListener(FAVORITES_EVENT, () => void render())
  void render()
}
