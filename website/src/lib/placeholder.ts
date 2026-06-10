// Branded duotone placeholders (ported from the design reference). Pure string
// builders so the same markup is produced server-side (Astro) and client-side
// (catalog show-more / similar grids). A real photo is layered ABOVE the
// silhouette and removes itself on error, so a broken/blocked image is never
// shown — the on-brand placeholder shows through instead.
import { escapeHtml } from './format'

export const SKYLINES: Record<string, string> = {
  grozny:
    '<path d="M0 120V70c0-2 2-4 4-4h26v-8h6v-18l5-7 5 7v18h6v54H0Zm70 0V40c0-3 2-5 5-5h2l5-22 5 22h2c3 0 5 2 5 5v80H70Zm60 0V58h-7l13-20 13 20h-7v62h-5Zm45 0V72c0-2 2-4 4-4h22v-9h7V41l5-8 5 8v18h7v9h22c2 0 4 2 4 4v48H175Z" fill="currentColor"/>',
  dubai:
    '<path d="M0 120v-30h18v30H0Zm26 0V70h22v50H26Zm30 0V52h16v68H56Zm95 0V18l8-18 8 18v102h-16Zm-60 0V40l6-10 6 10v80H86Zm38 0V62h14v58h-14Zm60 0V46h16v74h-16Zm26 0V78h20v42h-20Z" fill="currentColor"/>',
  riyadh:
    '<path d="M0 120V84h16v36H0Zm26 0V64h18v56H26Zm120 0V40c0-8 6-14 14-14s14 6 14 14v18h-9v-9a5 5 0 0 0-10 0v71h-23Zm-66 0V52h18v68H80Zm30 0V72h16v48h-16Zm84 0V70h22v50h-22Z" fill="currentColor"/>',
  city: '<path d="M0 120V80h20v40H0Zm28 0V60h24v60H28Zm32 0V42h20v78H60Zm28 0V70h16v50H88Zm60 0V50h22v70h-22Zm30 0V66h18v54h-18Zm26 0V84h20v36h-20Zm-90 0V58h22v62h-22Z" fill="currentColor"/>',
  villa: '<path d="M0 120V92h40V70l40-26 40 26h44v50H0Zm150-50 36-22 46 30v42h-82V70Z" fill="currentColor"/>',
}

export interface PlaceholderOptions {
  kind: string
  tone?: '' | 'ink' | 'sand'
  sun?: boolean
  photo?: string | null
  eager?: boolean
  /** overlay markup placed above the image (tags, captions, buttons) */
  overlay?: string
  /** extra classes for the container (e.g. card__media, hero__card-media) */
  extraClass?: string
}

export function phClass(tone?: string, extraClass?: string): string {
  return ['ph', tone ? `ph--${tone}` : '', extraClass ?? ''].filter(Boolean).join(' ')
}

// Inner markup of a `.ph` container (sky + sun + silhouette + photo + overlay).
export function phInner(opts: PlaceholderOptions): string {
  const sky = SKYLINES[opts.kind] ?? SKYLINES.city
  const photo = opts.photo
    ? `<img class="ph__photo" src="${escapeHtml(opts.photo)}" alt="" decoding="async"${
        opts.eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"'
      } onload="this.classList.add('is-loaded')" onerror="this.remove()">`
    : ''
  return (
    '<div class="ph__sky"></div>' +
    (opts.sun ? '<div class="sun"></div>' : '') +
    `<svg class="silhouette" viewBox="0 0 232 120" preserveAspectRatio="xMidYMax meet" width="232" height="120" aria-hidden="true">${sky}</svg>` +
    photo +
    '<div class="ph__tint"></div>' +
    '<div class="ph__grain"></div>' +
    `<div class="ph__overlay">${opts.overlay ?? ''}</div>`
  )
}

// Full `.ph` element as a string (container + inner).
export function phHtml(opts: PlaceholderOptions): string {
  return `<div class="${phClass(opts.tone, opts.extraClass)}">${phInner(opts)}</div>`
}
