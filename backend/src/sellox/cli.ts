import { createBackendRuntime } from '../runtime'
import { importSellox, type SelloxFetcher } from './import'

// Runnable entry for the one-time sellox.ru → Complex migration.
//
//   bun src/sellox/cli.ts --dry-run        # crawl + parse, write nothing
//   bun src/sellox/cli.ts --limit 5        # only the first 5 pages
//   bun src/sellox/cli.ts                  # import (create DRAFT, skip existing)
//   bun src/sellox/cli.ts --update         # also refresh untouched DRAFT rows

type Flags = { dryRun: boolean; update: boolean; limit?: number }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, update: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--update') flags.update = true
    else if (arg === '--limit') flags.limit = Number.parseInt(argv[(i += 1)] ?? '', 10) || undefined
    else if (arg.startsWith('--limit=')) flags.limit = Number.parseInt(arg.slice('--limit='.length), 10) || undefined
  }
  return flags
}

// Polite, throttled fetcher: a browser UA, a short delay between requests, and a
// hard timeout so one slow page can't hang the whole crawl.
function createPoliteFetcher(delayMs = 400): SelloxFetcher {
  let chain = Promise.resolve()
  return (url) => {
    const run = chain.then(async () => {
      const response = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; DuneImporter/1.0)', accept: 'text/html,application/xml' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return response.text()
    })
    chain = run.then(() => sleep(delayMs)).catch(() => sleep(delayMs))
    return run
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const flags = parseFlags(Bun.argv.slice(2))
  const runtime = createBackendRuntime()

  console.log(
    `sellox import — ${flags.dryRun ? 'DRY RUN (no writes)' : 'LIVE'}` +
      `${flags.update ? ', updating DRAFT rows' : ''}${flags.limit ? `, limit ${flags.limit}` : ''}`,
  )

  try {
    const summary = await importSellox(runtime.prisma, {
      fetcher: createPoliteFetcher(),
      dryRun: flags.dryRun,
      update: flags.update,
      limit: flags.limit,
      log: (message) => console.log(message),
    })

    console.log(
      `\nDone. total=${summary.total} created=${summary.created} updated=${summary.updated} ` +
        `skipped=${summary.skipped} failed=${summary.failed}`,
    )
    if (summary.failed > 0) {
      console.log('\nFailures:')
      for (const item of summary.items.filter((i) => i.action === 'failed')) {
        console.log(`  ${item.url} — ${item.reason}`)
      }
      process.exitCode = 1
    }
  } finally {
    await runtime.close()
  }
}

if (import.meta.main) {
  await main()
}
