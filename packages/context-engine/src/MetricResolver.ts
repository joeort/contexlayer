import type { DbClient } from '@context-layer/database/client'
import { MetricRepo } from '@context-layer/database'
import type { Metric, MetricVersion } from '@context-layer/shared'
import type { EmbeddingService } from './EmbeddingService.js'

export interface ResolvedMetric {
  metric: Metric
  version: MetricVersion | null
  changedRecently: boolean
  changeNote: string | null
}

// A definition changed "recently" if there's been a version change in the last 90 days
const RECENT_DAYS = 90

export class MetricResolver {
  private repo: MetricRepo

  constructor(db: DbClient, private embedding: EmbeddingService) {
    this.repo = new MetricRepo(db)
  }

  async resolveByName(name: string, orgId: string, asOfDate: Date): Promise<ResolvedMetric | null> {
    const metrics = await this.repo.listByOrg(orgId)
    const nameLower = name.toLowerCase()
    const match = metrics.find(
      (m) =>
        m.name.toLowerCase() === nameLower ||
        m.aliases.some((a) => a.toLowerCase() === nameLower)
    )
    if (!match) return null
    return this.buildResult(match, asOfDate)
  }

  async resolveBySemantic(query: string, orgId: string, asOfDate: Date): Promise<ResolvedMetric | null> {
    const vec = await this.embedding.embed(query)
    if (vec.length === 0) return null

    const similar = await this.repo.findSimilar(orgId, vec, 1)
    if (!similar[0]) return null
    return this.buildResult(similar[0], asOfDate)
  }

  async getVersionsInRange(metricId: string, periodStart: Date, periodEnd: Date): Promise<MetricVersion[]> {
    return this.repo.getVersionsInRange(metricId, periodStart, periodEnd)
  }

  private async buildResult(metric: Metric, asOfDate: Date): Promise<ResolvedMetric> {
    const version = await this.repo.getVersionAt(metric.id, asOfDate)

    // Check for recent definition changes
    const recentCutoff = new Date(asOfDate.getTime() - RECENT_DAYS * 86_400_000)
    const recentVersions = await this.repo.getVersionsInRange(metric.id, recentCutoff, asOfDate)
    const changedRecently = recentVersions.length > 1

    let changeNote: string | null = null
    if (changedRecently) {
      // The most recent previous version
      const prev = recentVersions.find((v) => v.id !== version?.id)
      if (prev) {
        const changeDate = version?.effectiveFrom?.toISOString().split('T')[0]
        changeNote = `${metric.name} definition changed on ${changeDate}. Results spanning this date may not be directly comparable.`
      }
    }

    return { metric, version, changedRecently, changeNote }
  }
}
