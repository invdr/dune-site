import { createBackendRuntime } from '../runtime'

// One-shot bulk publish for the catalog of residential complexes (ЖК).
//
//   bun src/complexes/publish-all-cli.ts            # publish every DRAFT ЖК
//   bun src/complexes/publish-all-cli.ts --dry-run  # just count, write nothing
//
// Flips DRAFT complexes to PUBLISHED and stamps publishedAt. Already published,
// archived, or sold complexes are left untouched.
async function main() {
  const dryRun = Bun.argv.includes('--dry-run')
  const runtime = createBackendRuntime()

  try {
    const pending = await runtime.prisma.complex.count({ where: { status: 'DRAFT' } })
    if (dryRun) {
      console.log(`DRY RUN: ${pending} draft complex(es) would be published.`)
      return
    }

    const { count } = await runtime.prisma.complex.updateMany({
      where: { status: 'DRAFT' },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
    console.log(`Published ${count} complex(es).`)
  } finally {
    await runtime.close()
  }
}

if (import.meta.main) {
  await main()
}
