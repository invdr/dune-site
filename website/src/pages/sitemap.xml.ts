import type { APIRoute } from 'astro'

import { listComplexes, listProperties } from '../lib/api'

// Rendered on demand: /zhk and /property are SSR routes, so their URLs come from
// the live API rather than the build. Cached for an hour at the edge/CDN.
export const prerender = false

const STATIC_PATHS = ['/', '/novostroyki', '/catalog']
// Safety cap so a misbehaving API can never spin this into an unbounded loop.
const MAX_PAGES = 50
const PAGE_SIZE = 100

async function allComplexUrls(): Promise<string[]> {
  const slugs: string[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await listComplexes({ page, limit: PAGE_SIZE, sort: 'newest' })
    slugs.push(...res.items.map((c) => `/zhk/${c.slug}`))
    if (page >= res.pageCount) break
  }
  return slugs
}

async function allPropertyUrls(): Promise<string[]> {
  const slugs: string[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await listProperties({ page, limit: PAGE_SIZE })
    slugs.push(...res.items.map((p) => `/property/${p.slug}`))
    if (page >= res.pageCount) break
  }
  return slugs
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const GET: APIRoute = async ({ site }) => {
  const origin = (site?.origin ?? 'https://dunestate.ru').replace(/\/$/, '')
  const [complexes, properties] = await Promise.all([allComplexUrls(), allPropertyUrls()])
  const paths = [...STATIC_PATHS, ...complexes, ...properties]

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${xmlEscape(`${origin}${p}`)}</loc></url>`).join('\n') +
    '\n</urlset>\n'

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
