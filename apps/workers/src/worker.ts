import { Worker } from 'bullmq'
import { connection } from './queues.js'
import { loadConnectors } from './connectors/registry.js'
import { schemaCrawlProcessor } from './processors/schema-crawl.js'
import { reportAnalyzeProcessor } from './processors/report-analyze.js'
import { embeddingGenProcessor } from './processors/embedding-gen.js'
import { contextCompileProcessor } from './processors/context-compile.js'

// Validate required env
const required = ['DATABASE_URL', 'REDIS_URL', 'ANTHROPIC_API_KEY']
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} environment variable is required`)
}

async function start() {
  await loadConnectors()

  const workers: Worker[] = []

  const connectorSyncWorker = new Worker(
    'connector.sync',
    async (job) => {
      const { jobType } = job.data
      if (jobType === 'schema_crawl' || jobType === 'incremental_sync') {
        return schemaCrawlProcessor(job)
      }
    },
    { connection, concurrency: 3 }
  )

  const reportAnalyzeWorker = new Worker(
    'report.analyze',
    reportAnalyzeProcessor,
    { connection, concurrency: 5, limiter: { max: 10, duration: 60_000 } }
  )

  const embeddingGenWorker = new Worker(
    'embedding.gen',
    embeddingGenProcessor,
    { connection, concurrency: 10 }
  )

  const contextCompileWorker = new Worker(
    'context.compile',
    contextCompileProcessor,
    { connection, concurrency: 2 }
  )

  workers.push(connectorSyncWorker, reportAnalyzeWorker, embeddingGenWorker, contextCompileWorker)

  for (const worker of workers) {
    worker.on('completed', (job) => {
      console.log(`[${job.queueName}] job ${job.id} completed`)
    })
    worker.on('failed', (job, err) => {
      console.error(`[${job?.queueName}] job ${job?.id} failed:`, err.message)
    })
  }

  console.log('Context Layer workers started. Queues: connector.sync, report.analyze, embedding.gen, context.compile')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down workers...')
    await Promise.all(workers.map((w) => w.close()))
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

start().catch((err) => {
  console.error('Worker startup failed:', err)
  process.exit(1)
})
