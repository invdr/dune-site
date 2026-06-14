import type { PropertyDto } from '@dune/contracts'

import { getProperty } from '../lib/api'
import { cardHtml } from '../lib/card'
import { FAVORITES_EVENT, getFavorites, refreshFavorites } from './favorites'
import { initReveal } from './ui'

// Renders the saved listings from localStorage. Fetched properties are cached
// so toggling a favourite off just drops its card without refetching the rest.
const cache = new Map<string, PropertyDto | null>()

async function resolve(slugs: string[]): Promise<PropertyDto[]> {
  const missing = slugs.filter((s) => !cache.has(s))
  await Promise.all(
    missing.map(async (slug) => {
      cache.set(slug, await getProperty(slug))
    }),
  )
  return slugs.map((s) => cache.get(s) ?? null).filter((p): p is PropertyDto => p !== null)
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
    const slugs = getFavorites()
    if (!slugs.length) {
      grid!.hidden = true
      grid!.innerHTML = ''
      loading!.hidden = true
      empty!.hidden = false
      rendering = false
      return
    }
    const items = await resolve(slugs)
    loading!.hidden = true
    if (!items.length) {
      grid!.hidden = true
      empty!.hidden = false
      rendering = false
      return
    }
    empty!.hidden = true
    grid!.hidden = false
    grid!.innerHTML = items.map((p) => cardHtml(p, { favorite: true })).join('')
    initReveal(grid!)
    grid!.querySelectorAll<HTMLElement>('.fade-up').forEach((e) => e.classList.add('in'))
    refreshFavorites()
    rendering = false
  }

  // Re-render when favourites change (e.g. user un-favourites a card here).
  window.addEventListener(FAVORITES_EVENT, () => void render())
  void render()
}
