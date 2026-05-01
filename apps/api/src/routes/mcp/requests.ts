import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

export async function mcpRequestRoutes(fastify: FastifyInstance) {
  // Recent MCP request log for the org
  fastify.get<{ Querystring: { limit?: string } }>(
    '/mcp/requests',
    { preHandler: requireAuth },
    async (request) => {
      const { orgId } = request.auth!
      const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 200)

      const { rows } = await fastify.db.query(
        `SELECT
           id, intent, intent_category,
           metrics_matched, fields_matched, rules_applied,
           latency_ms, created_at,
           context_served->>'sql' AS sql_generated
         FROM mcp_requests
         WHERE org_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [orgId, limit]
      )

      return rows.map((r) => ({
        id: r.id,
        intent: r.intent,
        intentCategory: r.intent_category,
        metricsMatched: r.metrics_matched ?? [],
        fieldsMatched: r.fields_matched ?? [],
        rulesApplied: r.rules_applied ?? [],
        latencyMs: r.latency_ms,
        sqlGenerated: !!r.sql_generated,
        createdAt: r.created_at,
      }))
    }
  )
}
