import type { DbClient } from '@context-layer/database/client'
import type { ContextBundle } from '@context-layer/shared'
import type { EmbeddingService } from './EmbeddingService.js'
import { FieldResolver } from './FieldResolver.js'
import { MetricResolver } from './MetricResolver.js'
import { RuleEngine } from './RuleEngine.js'
import { SqlGenerator, type TargetConnector } from './SqlGenerator.js'

export interface AssembleOptions {
  asOfDate?: Date
  includeSql?: boolean
  targetConnector?: TargetConnector
  periodStart?: string
  periodEnd?: string
  segment?: string
}

export class ContextAssembler {
  private fieldResolver: FieldResolver
  private metricResolver: MetricResolver
  private ruleEngine: RuleEngine
  private sqlGen: SqlGenerator

  constructor(db: DbClient, embedding: EmbeddingService) {
    this.fieldResolver = new FieldResolver(db, embedding)
    this.metricResolver = new MetricResolver(db, embedding)
    this.ruleEngine = new RuleEngine(db)
    this.sqlGen = new SqlGenerator()
  }

  async assemble(query: string, orgId: string, opts: AssembleOptions = {}): Promise<ContextBundle> {
    const asOfDate = opts.asOfDate ?? new Date()
    const target = opts.targetConnector ?? 'salesforce'
    const warnings: string[] = []
    const rulesApplied: string[] = []

    // 1. Try to identify a named metric in the query
    const metricResult = await this.metricResolver.resolveBySemantic(query, orgId, asOfDate)

    // 2. Resolve the primary field
    const fieldResult = await this.fieldResolver.resolve(query, orgId)

    if (fieldResult?.disambiguationNote) {
      warnings.push(fieldResult.disambiguationNote)
    }

    // 3. Get applicable business rules
    const rawRules = await this.ruleEngine.getApplicable(
      orgId,
      { metricId: metricResult?.metric.id },
      asOfDate
    )
    const appliedRules = this.ruleEngine.toApplied(rawRules)
    rulesApplied.push(...appliedRules.map((r) => r.title))

    // 4. Generate SQL
    let sql: string | undefined
    if (opts.includeSql !== false && metricResult?.version) {
      const { periodStart, periodEnd, segment } = opts

      // Check for definition changes within the requested period
      if (periodStart && periodEnd) {
        const pStart = new Date(periodStart)
        const pEnd = new Date(periodEnd)
        const versionsInRange = await this.metricResolver.getVersionsInRange(
          metricResult.metric.id,
          pStart,
          pEnd
        )

        if (versionsInRange.length > 1) {
          // Period-spanning: generate UNION across each version's active date range
          const segments = versionsInRange.map((v, i) => {
            const segStart =
              i === 0 ? periodStart : v.effectiveFrom.toISOString().split('T')[0]
            const segEnd =
              v.effectiveTo
                ? v.effectiveTo.toISOString().split('T')[0]
                : periodEnd
            return { version: v, periodStart: segStart, periodEnd: segEnd }
          })
          const gen = this.sqlGen.generateUnion(segments, appliedRules, target)
          sql = gen.sql
          warnings.push(...gen.warnings)
          rulesApplied.push(...gen.rulesApplied.filter((r) => !rulesApplied.includes(r)))
        } else {
          const gen = this.sqlGen.generate(
            metricResult.version,
            appliedRules,
            { periodStart, periodEnd, segment },
            target
          )
          sql = gen.sql
          warnings.push(...gen.warnings)
        }
      } else {
        const gen = this.sqlGen.generate(
          metricResult.version,
          appliedRules,
          { periodStart, periodEnd, segment },
          target
        )
        sql = gen.sql
        warnings.push(...gen.warnings)
      }
    }

    // 5. Add change warning if metric definition changed recently
    if (metricResult?.changedRecently && metricResult.changeNote) {
      warnings.push(metricResult.changeNote)
    }

    // 6. Assemble bundle
    const bundle: ContextBundle = {
      rulesApplied,
      warnings,
      contextNotes: null,
    }

    if (metricResult?.metric && metricResult.version) {
      bundle.metric = {
        name: metricResult.metric.name,
        version: metricResult.version.versionNumber,
        effectiveFrom: metricResult.version.effectiveFrom.toISOString().split('T')[0],
        notes: metricResult.version.notes,
        changedRecently: metricResult.changedRecently,
      }
    }

    if (fieldResult) {
      bundle.primaryField = {
        fieldName: fieldResult.fieldName,
        fieldLabel: fieldResult.fieldLabel,
        object: fieldResult.object,
        connector: fieldResult.connector,
        usageNote: fieldResult.usageNote,
        alternatives: fieldResult.alternatives,
      }
    }

    if (sql) {
      bundle.sql = sql
    }

    if (rawRules.length > 0) {
      const nuances = rawRules.filter((r) => r.ruleType === 'nuance' || r.ruleType === 'temporal_change')
      if (nuances.length > 0) {
        bundle.contextNotes = nuances.map((r) => r.description).join('\n\n')
      }
    }

    return bundle
  }
}
