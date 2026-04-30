import type { Job } from 'bullmq'
import { getPool, ConnectorRepo, FieldRepo, ReportRepo } from '@context-layer/database'
import { decryptCredentials } from '@context-layer/shared'
import type { ConnectorSyncJobData } from '@context-layer/shared'

export async function schemaCrawlProcessor(job: Job<ConnectorSyncJobData>) {
  const { orgId, connectorId, connectorType } = job.data
  const pool = getPool()
  const connectorRepo = new ConnectorRepo(pool)
  const fieldRepo = new FieldRepo(pool)
  const reportRepo = new ReportRepo(pool)

  const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!encryptionKey) throw new Error('CREDENTIAL_ENCRYPTION_KEY is required')

  console.log(`[schema-crawl] starting: org=${orgId} connector=${connectorId} type=${connectorType}`)

  await connectorRepo.setStatus(connectorId, 'active')

  try {
    const { ConnectorRegistry } = await import('../connectors/registry.js')
    const connector = ConnectorRegistry.get(connectorType)
    if (!connector) throw new Error(`No connector registered for type: ${connectorType}`)

    // Decrypt stored credentials before passing to connector
    const raw = await connectorRepo.getCredentials(connectorId)
    const credentials = raw.encrypted
      ? decryptCredentials(raw.encrypted as string, encryptionKey)
      : raw

    const ctx = { orgId, connectorId, credentials, fieldRepo, reportRepo }

    // 1. Schema crawl
    await connector.crawlSchema(ctx)
    console.log(`[schema-crawl] schema complete: connector=${connectorId}`)

    // 2. Report discovery (if the connector supports it)
    if (connector.fetchReports) {
      await connector.fetchReports(ctx)
      console.log(`[schema-crawl] report discovery complete: connector=${connectorId}`)
    }

    await connectorRepo.markSynced(connectorId)

    // 3. Queue downstream jobs
    const { ReportAnalyzeQueue, EmbeddingGenQueue, ContextCompileQueue } = await import('../queues.js')

    // Queue analysis for all pending reports (priority-sorted in repo)
    const pendingReports = await reportRepo.listPendingByPriority(orgId, 200)
    for (const report of pendingReports) {
      await ReportAnalyzeQueue.add(
        `analyze:${report.id}`,
        { orgId, connectorId: report.connectorId, reportId: report.id },
        { jobId: `analyze:${report.id}`, removeOnComplete: 50, removeOnFail: 50 }
      )
    }
    console.log(`[schema-crawl] queued ${pendingReports.length} report analysis jobs`)

    // Queue embedding generation for all un-embedded fields
    const { rows: fieldRows } = await pool.query(
      'SELECT id FROM schema_fields WHERE org_id = $1 AND embedding IS NULL',
      [orgId]
    )
    for (const row of fieldRows) {
      await EmbeddingGenQueue.add(
        `embed:field:${row.id}`,
        { orgId, entityType: 'field', entityId: row.id },
        { jobId: `embed:field:${row.id}`, removeOnComplete: 100, removeOnFail: 50 }
      )
    }
    console.log(`[schema-crawl] queued ${fieldRows.length} embedding jobs`)

    // Queue context compilation after everything settles (1 min delay)
    await ContextCompileQueue.add(
      `compile:${orgId}:${Date.now()}`,
      { orgId, trigger: 'schema_crawl' },
      { removeOnComplete: 10, removeOnFail: 10, delay: 60_000 }
    )

    console.log(`[schema-crawl] all downstream jobs queued: connector=${connectorId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await connectorRepo.setStatus(connectorId, 'error', message)
    throw err
  }
}
