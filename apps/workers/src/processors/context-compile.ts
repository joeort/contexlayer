import type { Job } from 'bullmq'
import { getPool, MetricRepo, BusinessRuleRepo } from '@context-layer/database'
import type { ContextCompileJobData } from '@context-layer/shared'

export async function contextCompileProcessor(job: Job<ContextCompileJobData>) {
  const { orgId, trigger } = job.data
  const pool = getPool()

  console.log(`[context-compile] starting: org=${orgId} trigger=${trigger}`)

  const metricRepo = new MetricRepo(pool)
  const ruleRepo = new BusinessRuleRepo(pool)

  const [metrics, rules] = await Promise.all([
    metricRepo.listByOrg(orgId, 'active'),
    ruleRepo.listActive(orgId),
  ])

  // Compile the full context bundle for this org
  const bundle = {
    orgId,
    compiledAt: new Date().toISOString(),
    metrics: await Promise.all(
      metrics.map(async (m) => ({
        id: m.id,
        name: m.name,
        aliases: m.aliases,
        category: m.category,
        currentVersion: await metricRepo.getVersionAt(m.id, new Date()),
      }))
    ),
    activeRules: rules.map((r) => ({
      id: r.id,
      type: r.ruleType,
      title: r.title,
      description: r.description,
      structuredRule: r.structuredRule,
    })),
  }

  // Persist to context_bundles (Redis cache is written by the MCP route on demand)
  await pool.query(
    `INSERT INTO context_bundles (org_id, bundle_type, content, cache_key, token_count)
     VALUES ($1, 'full', $2, $3, $4)
     ON CONFLICT (org_id, cache_key)
     DO UPDATE SET content = EXCLUDED.content, compiled_at = NOW(), token_count = EXCLUDED.token_count`,
    [
      orgId,
      JSON.stringify(bundle),
      `full:${orgId}`,
      Math.ceil(JSON.stringify(bundle).length / 4), // rough token estimate
    ]
  )

  console.log(
    `[context-compile] complete: org=${orgId} metrics=${metrics.length} rules=${rules.length}`
  )
}
