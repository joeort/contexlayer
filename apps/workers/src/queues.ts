import { Queue } from 'bullmq'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL is required')

export const connection = { url: redisUrl }

export const ConnectorSyncQueue = new Queue('connector.sync', { connection })
export const ReportAnalyzeQueue = new Queue('report.analyze', { connection })
export const EmbeddingGenQueue = new Queue('embedding.gen', { connection })
export const ContextCompileQueue = new Queue('context.compile', { connection })
