import { createBackendRuntime } from '../runtime'
import { resolveObjectStorage } from '../storage/object-storage'
import { importSellox, type PhotoMirror, type SelloxFetcher } from './import'
import { mirrorPhotos } from './photos'

// Runnable entry for the one-time sellox.ru → Complex migration.
//
//   bun src/sellox/cli.ts --dry-run        # crawl + parse, write nothing
//   bun src/sellox/cli.ts --limit 5        # only the first 5 pages
//   bun src/sellox/cli.ts                  # import (create DRAFT, skip existing)
//   bun src/sellox/cli.ts --update         # also refresh untouched DRAFT rows
//   bun src/sellox/cli.ts --force          # refresh ALL rows (incl. published)
//   bun src/sellox/cli.ts --mirror-photos  # copy photos into our own bucket

type Flags = { dryRun: boolean; update: boolean; force: boolean; mirrorPhotos: boolean; limit?: number }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, update: false, force: false, mirrorPhotos: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--update') flags.update = true
    else if (arg === '--force') flags.force = true
    else if (arg === '--mirror-photos') flags.mirrorPhotos = true
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

  // Resolve the photo mirror up front so a misconfigured bucket fails loudly
  // before any crawling, rather than silently leaving remote URLs in the DB.
  let photoMirror: PhotoMirror | undefined
  if (flags.mirrorPhotos && flags.dryRun) {
    console.log('Note: --dry-run skips photo mirroring (it would write to the bucket).')
  } else if (flags.mirrorPhotos) {
    const storage = resolveObjectStorage(runtime.env)
    if (!storage) {
      console.error(
        'Cannot mirror photos: no media storage is configured. Either set the local-disk ' +
          'driver (MEDIA_LOCAL_ROOT + MEDIA_PUBLIC_BASE_URL) or S3-compatible storage ' +
          '(SPACES_ENDPOINT, SPACES_REGION, SPACES_BUCKET, SPACES_ACCESS_KEY_ID, ' +
          'SPACES_SECRET_ACCESS_KEY, SPACES_CDN_BASE_URL).',
      )
      await runtime.close()
      process.exit(1)
    }
    photoMirror = async (slug, urls, kind) =>
      (await mirrorPhotos(storage, slug, urls, { subdir: kind === 'plan' ? 'plans' : undefined })).photos
  }

  console.log(
    `sellox import — ${flags.dryRun ? 'DRY RUN (no writes)' : 'LIVE'}` +
      `${flags.force ? ', forcing refresh of ALL rows' : flags.update ? ', updating DRAFT rows' : ''}` +
      `${flags.mirrorPhotos ? ', mirroring photos' : ''}${flags.limit ? `, limit ${flags.limit}` : ''}`,
  )

  try {
    const summary = await importSellox(runtime.prisma, {
      fetcher: createPoliteFetcher(),
      dryRun: flags.dryRun,
      update: flags.update,
      force: flags.force,
      mirrorPhotos: photoMirror,
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
