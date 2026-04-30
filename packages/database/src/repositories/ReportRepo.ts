import type { DbClient } from '../client.js'
import type { Report, AnalysisStatus, ReportAnalysisResult } from '@context-layer/shared'

function rowToReport(row: Record<string, unknown>): Report {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    connectorId: row.connector_id as string,
    externalId: row.external_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    reportType: row.report_type as Report['reportType'],
    url: (row.url as string) ?? null,
    rawDefinition: (row.raw_definition as Record<string, unknown>) ?? {},
    analysisStatus: row.analysis_status as AnalysisStatus,
    analysisResult: (row.analysis_result as ReportAnalysisResult) ?? null,
    analyzedAt: row.analyzed_at ? new Date(row.analyzed_at as string) : null,
    createdAt: new Date(row.created_at as string),
  }
}

export class ReportRepo {
  constructor(private db: DbClient) {}

  async listByOrg(orgId: string, status?: AnalysisStatus): Promise<Report[]> {
    const conditions = ['org_id = $1']
    const params: unknown[] = [orgId]
    if (status) {
      conditions.push(`analysis_status = $${params.length + 1}`)
      params.push(status)
    }
    const { rows } = await this.db.query(
      `SELECT * FROM reports WHERE ${conditions.join(' AND ')} ORDER BY name`,
      params
    )
    return rows.map(rowToReport)
  }

  async getById(id: string, orgId: string): Promise<Report | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM reports WHERE id = $1 AND org_id = $2',
      [id, orgId]
    )
    return rows[0] ? rowToReport(rows[0]) : null
  }

  async upsert(
    orgId: string,
    connectorId: string,
    data: Pick<Report, 'externalId' | 'name' | 'description' | 'reportType' | 'url' | 'rawDefinition'>
  ): Promise<Report> {
    const { rows } = await this.db.query(
      `INSERT INTO reports
         (org_id, connector_id, external_id, name, description, report_type, url, raw_definition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (connector_id, external_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         report_type = EXCLUDED.report_type,
         url = EXCLUDED.url,
         raw_definition = EXCLUDED.raw_definition
       RETURNING *`,
      [
        orgId, connectorId, data.externalId, data.name, data.description,
        data.reportType, data.url, JSON.stringify(data.rawDefinition),
      ]
    )
    return rowToReport(rows[0])
  }

  async setAnalysisStatus(id: string, status: AnalysisStatus): Promise<void> {
    await this.db.query(
      'UPDATE reports SET analysis_status = $1 WHERE id = $2',
      [status, id]
    )
  }

  async setAnalysisResult(id: string, result: ReportAnalysisResult): Promise<void> {
    await this.db.query(
      `UPDATE reports SET analysis_status = 'complete', analysis_result = $1, analyzed_at = NOW() WHERE id = $2`,
      [JSON.stringify(result), id]
    )
  }

  // Returns reports pending analysis, sorted by likely priority (revenue/booking in name first)
  async listPendingByPriority(orgId: string, limit = 50): Promise<Report[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM reports
       WHERE org_id = $1 AND analysis_status = 'pending'
       ORDER BY
         CASE WHEN name ILIKE ANY(ARRAY['%ARR%','%Booking%','%Pipeline%','%Revenue%','%Forecast%','%NRR%'])
              THEN 0 ELSE 1 END ASC,
         name ASC
       LIMIT $2`,
      [orgId, limit]
    )
    return rows.map(rowToReport)
  }
}
