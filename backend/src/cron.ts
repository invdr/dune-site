import { CurrencyService } from './currency/service'
import { QuickDealImporter } from './quickdeal/service'
import { createBackendRuntime, type BackendRuntime } from './runtime'

type CronTask = (runtime: BackendRuntime) => Promise<void>

const cronTasks = {
  noop: async () => {
    console.log('Cron noop task completed.')
  },
  'db:ping': async ({ prisma }) => {
    await prisma.$queryRaw`SELECT 1`
    console.log('Cron db:ping task completed.')
  },
  // Daily USD→RUB refresh from the CBR; on failure the last cached rate stands.
  'fx:refresh': async ({ prisma }) => {
    try {
      const { value } = await new CurrencyService(prisma).refreshFromCbr()
      console.log(`Cron fx:refresh updated USD→RUB to ${value}.`)
    } catch (error) {
      console.error('Cron fx:refresh failed; keeping last known rate.', error)
    }
  },
  // Hourly mirror of the QuickDeal feed.
  'quickdeal:sync': async ({ prisma, env }) => {
    const importer = new QuickDealImporter(prisma, {
      feedUrl: env.QUICKDEAL_FEED_URL ?? null,
      token: env.QUICKDEAL_FEED_TOKEN ?? null,
    })
    const result = await importer.sync()
    console.log(`Cron quickdeal:sync ${result.status}.`, result)
  },
} satisfies Record<string, CronTask>

export type CronTaskName = keyof typeof cronTasks

export async function runCronTask(taskName: string, runtime: BackendRuntime) {
  const task = cronTasks[taskName as CronTaskName]

  if (!task) {
    throw new Error(`Unknown cron task "${taskName}". Available tasks: ${Object.keys(cronTasks).join(', ')}`)
  }

  await task(runtime)
}

export async function main(argv: string[] = Bun.argv.slice(2)) {
  const [taskName] = argv

  if (!taskName) {
    console.error(`Cron task name is required. Available tasks: ${Object.keys(cronTasks).join(', ')}`)
    process.exit(1)
  }

  const runtime = createBackendRuntime()

  try {
    await runCronTask(taskName, runtime)
  } finally {
    await runtime.close()
  }
}

if (import.meta.main) {
  await main()
}
