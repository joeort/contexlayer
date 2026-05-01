import type { DbClient } from '../client.js'

export interface ApiKey {
  id: string
  orgId: string
  name: string
  keyPrefix: string
  lastUsedAt: Date | null
  expiresAt: Date | null
  isActive: boolean
  createdBy: string
  createdAt: Date
}

function rowToApiKey(row: Record<string, unknown>): ApiKey {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    keyPrefix: row.key_prefix as string,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    isActive: row.is_active as boolean,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
  }
}

export class ApiKeyRepo {
  constructor(private db: DbClient) {}

  async create(
    orgId: string,
    name: string,
    keyHash: string,
    keyPrefix: string,
    createdBy: string
  ): Promise<ApiKey> {
    const { rows } = await this.db.query(
      `INSERT INTO api_keys (org_id, name, key_hash, key_prefix, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId, name, keyHash, keyPrefix, createdBy]
    )
    return rowToApiKey(rows[0])
  }

  async findByHash(keyHash: string): Promise<{ orgId: string; keyId: string } | null> {
    const { rows } = await this.db.query(
      `SELECT id, org_id FROM api_keys
       WHERE key_hash = $1 AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [keyHash]
    )
    if (!rows[0]) return null
    await this.db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [rows[0].id]
    )
    return { orgId: rows[0].org_id as string, keyId: rows[0].id as string }
  }

  async listByOrg(orgId: string): Promise<ApiKey[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    )
    return rows.map(rowToApiKey)
  }

  async revoke(id: string, orgId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'UPDATE api_keys SET is_active = FALSE WHERE id = $1 AND org_id = $2',
      [id, orgId]
    )
    return (rowCount ?? 0) > 0
  }
}
