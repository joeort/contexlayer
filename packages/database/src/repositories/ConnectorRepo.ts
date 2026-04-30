import type { DbClient } from '../client.js'
import type { Connector, ConnectorStatus, ConnectorType } from '@context-layer/shared'

function rowToConnector(row: Record<string, unknown>): Connector {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    type: row.type as ConnectorType,
    displayName: row.display_name as string,
    status: row.status as ConnectorStatus,
    config: (row.config as Record<string, unknown>) ?? {},
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at as string) : null,
    errorMessage: (row.error_message as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export class ConnectorRepo {
  constructor(private db: DbClient) {}

  async listByOrg(orgId: string): Promise<Connector[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM connectors WHERE org_id = $1 ORDER BY display_name',
      [orgId]
    )
    return rows.map(rowToConnector)
  }

  async getById(id: string, orgId: string): Promise<Connector | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM connectors WHERE id = $1 AND org_id = $2',
      [id, orgId]
    )
    return rows[0] ? rowToConnector(rows[0]) : null
  }

  async create(
    orgId: string,
    data: Pick<Connector, 'type' | 'displayName' | 'config'>
  ): Promise<Connector> {
    const { rows } = await this.db.query(
      `INSERT INTO connectors (org_id, type, display_name, config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orgId, data.type, data.displayName, JSON.stringify(data.config)]
    )
    return rowToConnector(rows[0])
  }

  async setCredentials(id: string, encrypted: Record<string, unknown>): Promise<void> {
    await this.db.query(
      'UPDATE connectors SET credentials = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(encrypted), id]
    )
  }

  async getCredentials(id: string): Promise<Record<string, unknown>> {
    const { rows } = await this.db.query(
      'SELECT credentials FROM connectors WHERE id = $1',
      [id]
    )
    return (rows[0]?.credentials as Record<string, unknown>) ?? {}
  }

  async setStatus(id: string, status: ConnectorStatus, errorMessage?: string): Promise<void> {
    await this.db.query(
      `UPDATE connectors SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
      [status, errorMessage ?? null, id]
    )
  }

  async markSynced(id: string, cursor?: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `UPDATE connectors SET last_synced_at = NOW(), sync_cursor = $1, updated_at = NOW() WHERE id = $2`,
      [cursor ? JSON.stringify(cursor) : null, id]
    )
  }
}
