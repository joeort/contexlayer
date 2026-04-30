import type { DbClient } from '../client.js'
import type { Metric, MetricVersion, MetricStatus } from '@context-layer/shared'

function rowToMetric(row: Record<string, unknown>): Metric {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    aliases: (row.aliases as string[]) ?? [],
    description: (row.description as string) ?? null,
    category: row.category as Metric['category'],
    status: row.status as MetricStatus,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function rowToVersion(row: Record<string, unknown>): MetricVersion {
  return {
    id: row.id as string,
    metricId: row.metric_id as string,
    orgId: row.org_id as string,
    versionNumber: row.version_number as number,
    effectiveFrom: new Date(row.effective_from as string),
    effectiveTo: row.effective_to ? new Date(row.effective_to as string) : null,
    definition: row.definition as MetricVersion['definition'],
    sqlTemplate: (row.sql_template as string) ?? null,
    notes: (row.notes as string) ?? null,
    source: row.source as MetricVersion['source'],
    sourceRef: (row.source_ref as string) ?? null,
    authoredBy: row.authored_by as string,
    createdAt: new Date(row.created_at as string),
  }
}

export class MetricRepo {
  constructor(private db: DbClient) {}

  async listByOrg(orgId: string, status?: MetricStatus): Promise<Metric[]> {
    const conditions = ['org_id = $1']
    const params: unknown[] = [orgId]
    if (status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(status)
    }
    const { rows } = await this.db.query(
      `SELECT * FROM metrics WHERE ${conditions.join(' AND ')} ORDER BY name`,
      params
    )
    return rows.map(rowToMetric)
  }

  async getById(id: string, orgId: string): Promise<Metric | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM metrics WHERE id = $1 AND org_id = $2',
      [id, orgId]
    )
    return rows[0] ? rowToMetric(rows[0]) : null
  }

  async create(
    orgId: string,
    data: Pick<Metric, 'name' | 'aliases' | 'description' | 'category'>
  ): Promise<Metric> {
    const { rows } = await this.db.query(
      `INSERT INTO metrics (org_id, name, aliases, description, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId, data.name, data.aliases, data.description, data.category]
    )
    return rowToMetric(rows[0])
  }

  async getVersionAt(metricId: string, asOfDate: Date): Promise<MetricVersion | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM metric_versions
       WHERE metric_id = $1
         AND effective_from <= $2
         AND (effective_to IS NULL OR effective_to > $2)
       ORDER BY effective_from DESC
       LIMIT 1`,
      [metricId, asOfDate.toISOString().split('T')[0]]
    )
    return rows[0] ? rowToVersion(rows[0]) : null
  }

  async getVersionsInRange(
    metricId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<MetricVersion[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM metric_versions
       WHERE metric_id = $1
         AND effective_from < $3
         AND (effective_to IS NULL OR effective_to > $2)
       ORDER BY effective_from ASC`,
      [
        metricId,
        periodStart.toISOString().split('T')[0],
        periodEnd.toISOString().split('T')[0],
      ]
    )
    return rows.map(rowToVersion)
  }

  async listVersions(metricId: string): Promise<MetricVersion[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM metric_versions WHERE metric_id = $1 ORDER BY version_number DESC',
      [metricId]
    )
    return rows.map(rowToVersion)
  }

  async addVersion(
    metricId: string,
    orgId: string,
    data: Pick<MetricVersion, 'effectiveFrom' | 'definition' | 'notes' | 'source' | 'sourceRef'>
  ): Promise<MetricVersion> {
    // close previous open version
    await this.db.query(
      `UPDATE metric_versions
       SET effective_to = $1
       WHERE metric_id = $2
         AND effective_to IS NULL
         AND effective_from < $1`,
      [data.effectiveFrom.toISOString().split('T')[0], metricId]
    )

    const { rows: countRows } = await this.db.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM metric_versions WHERE metric_id = $1',
      [metricId]
    )
    const nextVersion = countRows[0].next as number

    const { rows } = await this.db.query(
      `INSERT INTO metric_versions
         (metric_id, org_id, version_number, effective_from, definition, notes, source, source_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        metricId,
        orgId,
        nextVersion,
        data.effectiveFrom.toISOString().split('T')[0],
        JSON.stringify(data.definition),
        data.notes,
        data.source,
        data.sourceRef,
      ]
    )
    return rowToVersion(rows[0])
  }

  // Semantic search: find metrics by embedding similarity
  async findSimilar(orgId: string, embedding: number[], limit = 5): Promise<Metric[]> {
    const { rows } = await this.db.query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
       FROM metrics
       WHERE org_id = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(embedding), orgId, limit]
    )
    return rows.map(rowToMetric)
  }
}
