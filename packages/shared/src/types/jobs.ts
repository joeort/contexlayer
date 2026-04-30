export type JobType =
  | 'schema_crawl'
  | 'report_sync'
  | 'report_analyze'
  | 'embedding_gen'
  | 'context_compile'
  | 'incremental_sync'

export type JobStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface SyncJob {
  id: string
  orgId: string
  connectorId: string
  jobType: JobType
  status: JobStatus
  startedAt: Date | null
  completedAt: Date | null
  recordsProcessed: number | null
  errorDetails: Record<string, unknown> | null
  createdAt: Date
}

// BullMQ job data payloads
export interface ConnectorSyncJobData {
  orgId: string
  connectorId: string
  connectorType: string
  jobType: JobType
}

export interface ReportAnalyzeJobData {
  orgId: string
  connectorId: string
  reportId: string
}

export interface EmbeddingGenJobData {
  orgId: string
  entityType: 'field' | 'metric' | 'business_rule'
  entityId: string
}

export interface ContextCompileJobData {
  orgId: string
  trigger: 'sync_complete' | 'manual' | 'definition_change'
}
