// Local favourites — slugs only, no account, no server state (§4.7). Persisted
// in localStorage so the list survives reloads. Cards carry `data-fav="<slug>"`
// on their heart button; this module hydrates their on/off state and keeps any
// `[data-fav-count]` badges in sync via a change event.
const KEY = 'dune:favorites'
const EVENT = 'dune:favorites-changed'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function write(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage full or unavailable — favourites silently no-op */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function getFavorites(): string[] {
  return read()
}

export function isFavorite(slug: string): boolean {
  return read().includes(slug)
}

export function toggleFavorite(slug: string): boolean {
  const list = read()
  const idx = list.indexOf(slug)
  if (idx >= 0) {
    list.splice(idx, 1)
    write(list)
    return false
  }
  list.push(slug)
  write(list)
  return true
}

function syncButton(btn: HTMLElement): void {
  const slug = btn.getAttribute('data-fav')
  if (!slug) return
  const on = isFavorite(slug)
  btn.classList.toggle('is-on', on)
  btn.setAttribute('aria-pressed', on ? 'true' : 'false')
}

function syncAll(): void {
  document.querySelectorAll<HTMLElement>('[data-fav]').forEach(syncButton)
  const count = read().length
  document.querySelectorAll<HTMLElement>('[data-fav-count]').forEach((el) => {
    el.textContent = String(count)
    el.toggleAttribute('hidden', count === 0)
  })
}

export function initFavorites(): void {
  // Delegated toggle: works for server-rendered and dynamically injected cards.
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const btn = target.closest<HTMLElement>('[data-fav]')
    if (!btn) return
    e.preventDefault()
    e.stopPropagation()
    const slug = btn.getAttribute('data-fav')
    if (slug) toggleFavorite(slug)
  })
  window.addEventListener(EVENT, syncAll)
  // Cross-tab sync.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) syncAll()
  })
  syncAll()
}

export const FAVORITES_EVENT = EVENT

// Re-sync button/count state after a grid is (re)rendered dynamically.
export function refreshFavorites(): void {
  syncAll()
}
