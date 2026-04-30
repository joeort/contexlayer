import type { DbClient } from '@context-layer/database/client'
import { BusinessRuleRepo } from '@context-layer/database'
import type { BusinessRule } from '@context-layer/shared'

export interface AppliedRule {
  ruleId: string
  title: string
  sqlClause: string | null
  description: string
}

export class RuleEngine {
  private repo: BusinessRuleRepo

  constructor(db: DbClient) {
    this.repo = new BusinessRuleRepo(db)
  }

  async getApplicable(
    orgId: string,
    context: { metricId?: string; objectName?: string; connectorType?: string },
    asOfDate: Date
  ): Promise<BusinessRule[]> {
    const all = await this.repo.listActive(orgId, asOfDate)
    return all.filter((rule) => {
      const at = rule.appliesTo
      // No appliesTo = universal rule (applies to all)
      if (!at || Object.keys(at).length === 0) return true
      if (at.metrics?.length && context.metricId) return at.metrics.includes(context.metricId)
      if (at.objects?.length && context.objectName) return at.objects.includes(context.objectName)
      if (at.connectors?.length && context.connectorType) return at.connectors.includes(context.connectorType)
      return true
    })
  }

  toSqlClause(rule: BusinessRule): string | null {
    const sr = rule.structuredRule
    if (!sr) return null

    if (rule.ruleType === 'filter') {
      const { field, op, value } = sr as { field?: string; op?: string; value?: unknown }
      if (field && op && value !== undefined) {
        const val = typeof value === 'string' ? `'${value}'` : String(value)
        return `${field} ${op} ${val}`
      }
    }

    if (rule.ruleType === 'exclusion') {
      const { field, values } = sr as { field?: string; values?: string[] }
      if (field && values?.length) {
        const quoted = values.map((v) => `'${v}'`).join(', ')
        return `${field} NOT IN (${quoted})`
      }
      const { field: f2, value: v2 } = sr as { field?: string; value?: string }
      if (f2 && v2) return `${f2} != '${v2}'`
    }

    return null
  }

  toApplied(rules: BusinessRule[]): AppliedRule[] {
    return rules.map((r) => ({
      ruleId: r.id,
      title: r.title,
      sqlClause: this.toSqlClause(r),
      description: r.description,
    }))
  }
}
