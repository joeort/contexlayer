import type { MetricVersion } from '@context-layer/shared'
import type { AppliedRule } from './RuleEngine.js'

export type TargetConnector = 'salesforce' | 'snowflake' | 'bigquery' | 'redshift'

export interface SqlParams {
  periodStart?: string  // YYYY-MM-DD
  periodEnd?: string    // YYYY-MM-DD
  segment?: string      // field name to group by
}

export interface GeneratedSql {
  sql: string
  fieldsUsed: string[]
  rulesApplied: string[]
  warnings: string[]
}

export class SqlGenerator {
  generate(
    version: MetricVersion,
    rules: AppliedRule[],
    params: SqlParams,
    target: TargetConnector
  ): GeneratedSql {
    const def = version.definition
    const pf = def.primaryField
    const fieldsUsed: string[] = [`${pf.object}.${pf.field}`]
    const warnings: string[] = []

    // Build WHERE clauses from the metric definition filters
    const whereClauses: string[] = []

    for (const filter of def.filters ?? []) {
      const val = typeof filter.value === 'string' ? `'${filter.value}'` : String(filter.value)
      whereClauses.push(`${filter.field} ${filter.op} ${val}`)
    }

    // Apply rule clauses
    const ruleNames: string[] = []
    for (const rule of rules) {
      if (rule.sqlClause) {
        whereClauses.push(rule.sqlClause)
        ruleNames.push(rule.title)
      }
    }

    // Apply period filter — guess the date field from common names
    const dateField = def.filters?.find(
      (f) => f.field.toLowerCase().includes('date') || f.field.toLowerCase().includes('closedate')
    )?.field ?? (target === 'salesforce' ? 'CloseDate' : 'close_date')

    if (params.periodStart) {
      whereClauses.push(
        target === 'salesforce'
          ? `${dateField} >= ${params.periodStart}`
          : `${dateField} >= '${params.periodStart}'`
      )
    }
    if (params.periodEnd) {
      whereClauses.push(
        target === 'salesforce'
          ? `${dateField} <= ${params.periodEnd}`
          : `${dateField} <= '${params.periodEnd}'`
      )
    }

    // Period-spanning UNION handled upstream (ContextAssembler knows about version changes)
    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join('\n  AND ')}` : ''

    const aggregation = def.aggregation ?? 'SUM'
    const segmentFields = [...(def.segmentBy ?? []), ...(params.segment ? [params.segment] : [])]

    let sql: string

    if (target === 'salesforce') {
      // SOQL
      const selectParts = [
        segmentFields.length > 0 ? `${aggregation}(${pf.field}) total` : `${aggregation}(${pf.field})`,
        ...segmentFields,
      ]
      const groupBy = segmentFields.length > 0 ? `\nGROUP BY ${segmentFields.join(', ')}` : ''
      sql = `SELECT ${selectParts.join(', ')}\nFROM ${pf.object}\n${whereClause}${groupBy}`.trim()
    } else {
      // Standard SQL (Snowflake / BigQuery / Redshift)
      const table = pf.connector ? `${pf.connector}.${pf.object}` : pf.object
      const selectParts = [
        `${aggregation}(${pf.field}) AS value`,
        ...segmentFields.map((s) => s),
      ]
      const groupBy = segmentFields.length > 0 ? `\nGROUP BY ${segmentFields.join(', ')}` : ''
      sql = `SELECT ${selectParts.join(',\n       ')}\nFROM ${table}\n${whereClause}${groupBy}`.trim()
    }

    // Clean up extra blank lines
    sql = sql.replace(/\n\n+/g, '\n')

    if (rules.length === 0 && def.filters?.length === 0) {
      warnings.push('No filters or business rules applied — double-check the metric definition.')
    }

    return { sql, fieldsUsed, rulesApplied: ruleNames, warnings }
  }

  // Generate a period-spanning UNION when the metric definition changed mid-period
  generateUnion(
    versions: Array<{ version: MetricVersion; periodStart: string; periodEnd: string }>,
    rules: AppliedRule[],
    target: TargetConnector
  ): GeneratedSql {
    const parts = versions.map(({ version, periodStart, periodEnd }, i) => {
      const gen = this.generate(version, rules, { periodStart, periodEnd }, target)
      // Wrap with period label
      const label = `v${version.versionNumber}`
      if (target === 'salesforce') {
        return `-- Period: ${periodStart} → ${periodEnd} (definition ${label})\n${gen.sql}`
      }
      return `-- Period: ${periodStart} → ${periodEnd} (definition ${label})\n${gen.sql}`
    })

    const sql = parts.join('\n\nUNION ALL\n\n')
    const allFields = Array.from(new Set(versions.flatMap((v) => [`${v.version.definition.primaryField.object}.${v.version.definition.primaryField.field}`])))
    const allRules = Array.from(new Set(rules.map((r) => r.title)))

    return {
      sql,
      fieldsUsed: allFields,
      rulesApplied: allRules,
      warnings: [`This metric had ${versions.length} different definitions during the requested period. Pre- and post-change results are in separate UNION segments.`],
    }
  }
}
