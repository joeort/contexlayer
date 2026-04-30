import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { EmbeddingService, ContextAssembler, FieldResolver, MetricResolver, RuleEngine, SqlGenerator } from '@context-layer/context-engine'
import { MetricRepo } from '@context-layer/database'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'

const testSchema = z.object({
  tool: z.enum(['get_context', 'resolve_field', 'get_metric_definition', 'generate_sql']),
  params: z.record(z.unknown()),
})

// Admin-facing test endpoint — uses Clerk JWT auth (not an API key)
// Lets the web UI fire MCP tool calls without needing to know the org's MCP API key
export async function mcpTestRoutes(fastify: FastifyInstance) {
  fastify.post('/mcp/test', { preHandler: requireAuth }, async (request, reply) => {
    const { tool, params } = testSchema.parse(request.body)
    const { orgId } = request.auth!

    const embedding = new EmbeddingService(config.OPENAI_API_KEY)
    const assembler = new ContextAssembler(fastify.db, embedding)
    const fieldResolver = new FieldResolver(fastify.db, embedding)
    const metricResolver = new MetricResolver(fastify.db, embedding)
    const ruleEngine = new RuleEngine(fastify.db)
    const sqlGen = new SqlGenerator()

    const asOfDate = params.as_of_date ? new Date(params.as_of_date as string) : new Date()

    try {
      let result: unknown

      if (tool === 'get_context') {
        result = await assembler.assemble(params.query as string, orgId, {
          asOfDate,
          includeSql: params.include_sql !== false,
          targetConnector: (params.target_connector as any) ?? 'salesforce',
          periodStart: params.period_start as string | undefined,
          periodEnd: params.period_end as string | undefined,
        })
      } else if (tool === 'resolve_field') {
        result = await fieldResolver.resolve(params.concept as string, orgId, {
          objectHint: params.object_hint as string | undefined,
          connectorHint: params.connector_hint as string | undefined,
        })
      } else if (tool === 'get_metric_definition') {
        const resolved = await metricResolver.resolveByName(params.metric_name as string, orgId, asOfDate)
        if (!resolved) {
          const metricRepo = new MetricRepo(fastify.db)
          const all = await metricRepo.listByOrg(orgId)
          result = { found: false, available: all.map((m) => m.name) }
        } else {
          result = {
            found: true,
            name: resolved.metric.name,
            version: resolved.version?.versionNumber,
            effectiveFrom: resolved.version?.effectiveFrom.toISOString().split('T')[0],
            definition: resolved.version?.definition,
            notes: resolved.version?.notes,
            changedRecently: resolved.changedRecently,
            changeNote: resolved.changeNote,
          }
        }
      } else if (tool === 'generate_sql') {
        const metricResult = await metricResolver.resolveBySemantic(params.intent as string, orgId, asOfDate)
        if (!metricResult?.version) {
          result = { generated: false, error: 'No metric found for this intent' }
        } else {
          const rawRules = await ruleEngine.getApplicable(orgId, { metricId: metricResult.metric.id }, asOfDate)
          const appliedRules = ruleEngine.toApplied(rawRules)
          const generated = sqlGen.generate(metricResult.version, appliedRules, {
            periodStart: params.period_start as string | undefined,
            periodEnd: params.period_end as string | undefined,
          }, (params.target_connector as any) ?? 'salesforce')
          result = { generated: true, metric: metricResult.metric.name, ...generated }
        }
      }

      return reply.send({ tool, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(500).send({ tool, error: message })
    }
  })
}
