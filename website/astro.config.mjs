// @ts-check
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

// SSR-capable build. Per the website README "SSR upgrade path": a Node adapter
// is installed and `output` stays 'static', so pages are prerendered to HTML by
// default and only routes that opt in with `export const prerender = false`
// render on demand. With an adapter `astro build` emits `dist/client` (static
// assets/HTML) plus `dist/server` (runtime entry); deploy this surface as an
// App Platform service, not a Static Site.
//
// DUNE uses SSR for the data-driven storefront so per-listing pages get real,
// crawlable URLs (`/property/[slug]`) with SEO-critical content in the initial
// HTML rendered from the live API, and the catalog reflects its query filters
// server-side. The backend base URL is read at request time from PUBLIC_API_URL.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://dunestate.ru',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
})
