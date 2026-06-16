import type { APIRoute } from 'astro'

// Rendered on demand so the Sitemap line uses the deployment's real origin.
export const prerender = false

export const GET: APIRoute = ({ site }) => {
  const origin = (site?.origin ?? 'https://dunestate.ru').replace(/\/$/, '')
  const body = [
    'User-agent: *',
    'Allow: /',
    // Per-browser, no-index personal page — nothing to crawl.
    'Disallow: /favorites',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
