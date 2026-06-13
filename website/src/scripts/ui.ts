// Shared chrome interactions ported from the design reference: mobile drawer,
// header shadow on scroll, and scroll-reveal for `.fade-up`. Imported by every
// page; safe to run immediately because module scripts execute after parse.

function initDrawer(): void {
  const burger = document.querySelector<HTMLElement>('[data-burger]')
  const drawer = document.querySelector<HTMLElement>('[data-drawer]')
  if (!burger || !drawer) return
  const open = () => {
    drawer.classList.add('is-open')
    document.body.style.overflow = 'hidden'
  }
  const close = () => {
    drawer.classList.remove('is-open')
    document.body.style.overflow = ''
  }
  burger.addEventListener('click', open)
  drawer.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).matches('[data-drawer-close],.drawer__scrim')) close()
  })
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', close))
}

function initHeader(): void {
  const h = document.querySelector<HTMLElement>('.site-header')
  if (!h) return
  const on = () => {
    h.classList.toggle('is-scrolled', window.scrollY > 10)
  }
  on()
  window.addEventListener('scroll', on, { passive: true })
}

// Rect-based reveal (bulletproof): no IntersectionObserver dependency, with a
// safety timer that reveals everything if scroll never fires.
const revealEls: HTMLElement[] = []
let safetyTimer: ReturnType<typeof setTimeout> | undefined

export function checkReveal(): void {
  const vh = window.innerHeight || document.documentElement.clientHeight
  for (let i = revealEls.length - 1; i >= 0; i--) {
    const el = revealEls[i]
    const r = el.getBoundingClientRect()
    if (r.top < vh * 0.92 && r.bottom > 0) {
      el.classList.add('in')
      revealEls.splice(i, 1)
    }
  }
}

export function initReveal(root?: ParentNode): void {
  const els = Array.from((root ?? document).querySelectorAll<HTMLElement>('.fade-up:not(.in)'))
  if (!els.length) return
  els.forEach((e) => {
    if (revealEls.indexOf(e) < 0) revealEls.push(e)
  })
  checkReveal()
  if (safetyTimer) clearTimeout(safetyTimer)
  safetyTimer = setTimeout(() => {
    revealEls.forEach((e) => e.classList.add('in'))
    revealEls.length = 0
  }, 2600)
}

export function initChrome(): void {
  document.documentElement.classList.add('js')
  initDrawer()
  initHeader()
  initReveal()
  window.addEventListener('scroll', checkReveal, { passive: true })
  window.addEventListener('resize', checkReveal, { passive: true })
}
