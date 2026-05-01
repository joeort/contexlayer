import type { DbClient } from '../client.js'
import type { BusinessRule, BusinessRuleType } from '@context-layer/shared'

function rowToRule(row: Record<string, unknown>): BusinessRule {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    ruleType: row.rule_type as BusinessRuleType,
    title: row.title as string,
    description: row.description as string,
    appliesTo: (row.applies_to as BusinessRule['appliesTo']) ?? {},
    structuredRule: (row.structured_rule as Record<string, unknown>) ?? null,
    effectiveFrom: row.effective_from ? new Date(row.effective_from as string) : null,
    effectiveTo: row.effective_to ? new Date(row.effective_to as string) : null,
    priority: row.priority as number,
    isActive: row.is_active as boolean,
    source: row.source as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export class BusinessRuleRepo {
  constructor(private db: DbClient) {}

  async listActive(orgId: string, asOfDate?: Date): Promise<BusinessRule[]> {
    const date = asOfDate ?? new Date()
    const dateStr = date.toISOString().split('T')[0]
    const { rows } = await this.db.query(
      `SELECT * FROM business_rules
       WHERE org_id = $1
         AND is_active = TRUE
         AND (effective_from IS NULL OR effective_from <= $2)
         AND (effective_to IS NULL OR effective_to > $2)
       ORDER BY priority ASC, created_at ASC`,
      [orgId, dateStr]
    )
    return rows.map(rowToRule)
  }

  async listByType(orgId: string, ruleType: BusinessRuleType): Promise<BusinessRule[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM business_rules WHERE org_id = $1 AND rule_type = $2 ORDER BY priority`,
      [orgId, ruleType]
    )
    return rows.map(rowToRule)
  }

  async create(
    orgId: string,
    data: Pick<BusinessRule, 'ruleType' | 'title' | 'description' | 'appliesTo' | 'structuredRule' | 'effectiveFrom' | 'effectiveTo' | 'priority'>
  ): Promise<BusinessRule> {
    const { rows } = await this.db.query(
      `INSERT INTO business_rules
         (org_id, rule_type, title, description, applies_to, structured_rule,
          effective_from, effective_to, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orgId, data.ruleType, data.title, data.description,
        JSON.stringify(data.appliesTo), JSON.stringify(data.structuredRule),
        data.effectiveFrom?.toISOString().split('T')[0] ?? null,
        data.effectiveTo?.toISOString().split('T')[0] ?? null,
        data.priority,
      ]
    )
    return rowToRule(rows[0])
  }

  async listAll(orgId: string): Promise<BusinessRule[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM business_rules WHERE org_id = $1 ORDER BY priority ASC, created_at DESC`,
      [orgId]
    )
    return rows.map(rowToRule)
  }

  async deactivate(id: string, orgId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE business_rules SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    )
    return (rowCount ?? 0) > 0
  }

  async findSimilar(orgId: string, embedding: number[], limit = 5): Promise<BusinessRule[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM business_rules
       WHERE org_id = $2 AND is_active = TRUE AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(embedding), orgId, limit]
    )
    return rows.map(rowToRule)
  }
}
