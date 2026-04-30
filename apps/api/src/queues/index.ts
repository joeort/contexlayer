import { Queue } from 'bullmq'
import { config } from '../config.js'

const connection = { url: config.REDIS_URL }

export const ConnectorSyncQueue = new Queue('connector.sync', { connection })
export const ReportAnalyzeQueue = new Queue('report.analyze', { connection })
export const EmbeddingGenQueue = new Queue('embedding.gen', { connection })
export const ContextCompileQueue = new Queue('context.compile', { connection })
