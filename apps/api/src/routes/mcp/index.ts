import type { FastifyInstance } from 'fastify'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { EmbeddingService, ContextAssembler, FieldResolver, MetricResolver, RuleEngine, SqlGenerator } from '@context-layer/context-engine'
import { MetricRepo } from '@context-layer/database'
import type { ContextBundle } from '@context-layer/shared'
import { config } from '../../config.js'

// MVP: parse orgId from key format cl_org_{orgId}_{secret}
// Phase 3 will replace this with a DB lookup of a hashed key
function resolveOrgFromApiKey(apiKey: string): string | null {
  const cleaned = apiKey.replace(/^Bearer\s+/, '')
  const parts = cleaned.split('_')
  if (parts[0] === 'cl' && parts[1] === 'org' && parts[2]) return parts[2]
  return null
}

export async function mcpRoutes(fastify: FastifyInstance) {
  // MCP JSON-RPC endpoint (StreamableHTTP transport for Claude Desktop / remote clients)
  fastify.all('/mcp/v1', async (request, reply) => {
    const apiKey = (request.headers['x-api-key'] as string) ?? ''
    const orgId = resolveOrgFromApiKey(apiKey)
    if (!orgId) {
      return reply.status(401).send({ error: 'Invalid or missing API key. Format: cl_org_{orgId}_{secret}' })
    }

    const server = buildMcpServer(fastify, orgId)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    await transport.handleRequest(request.raw, reply.raw, request.body as Record<string, unknown>)
  })
}

function buildMcpServer(fastify: FastifyInstance, orgId: string): McpServer {
  const embedding = new EmbeddingService(config.OPENAI_API_KEY)
  const assembler = new ContextAssembler(fastify.db, embedding)
  const fieldResolver = new FieldResolver(fastify.db, embedding)
  const metricResolver = new MetricResolver(fastify.db, embedding)
  const ruleEngine = new RuleEngine(fastify.db)
  const sqlGen = new SqlGenerator()

  const server = new McpServer({ name: 'context-layer', version: '0.1.0' })

  // ─── get_context ─────────────────────────────────────────────────────────
  server.tool(
    'get_context',
    'Get organizational context for a GTM question. Returns the relevant metric definition, canonical field, applicable business rules, and ready-to-run SQL.',
    {
      query: z.string().describe('The question or analysis task'),
      as_of_date: z.string().optional().describe('ISO 8601 date for temporal definitions (defaults to today)'),
      include_sql: z.boolean().optional().default(true),
      period_start: z.string().optional().describe('Start of analysis period YYYY-MM-DD'),
      period_end: z.string().optional().describe('End of analysis period YYYY-MM-DD'),
      target_connector: z.enum(['salesforce', 'snowflake', 'bigquery', 'redshift']).optional().default('salesforce'),
    },
    async ({ query, as_of_date, include_sql, period_start, period_end, target_connector }) => {
      const start = Date.now()
      const asOfDate = as_of_date ? new Date(as_of_date) : new Date()

      const bundle = await assembler.assemble(query, orgId, {
        asOfDate,
        includeSql: include_sql,
        targetConnector: target_connector,
        periodStart: period_start,
        periodEnd: period_end,
      })

      const latencyMs = Date.now() - start

      // Audit log
      await fastify.db.query(
        `INSERT INTO mcp_requests
           (org_id, intent, intent_category, context_served, metrics_matched, fields_matched, rules_applied, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orgId, query, 'metric_lookup', JSON.stringify(bundle),
          bundle.metric ? [bundle.metric.name] : [],
          bundle.primaryField ? [bundle.primaryField.fieldName] : [],
          bundle.rulesApplied, latencyMs,
        ]
      )

      return { content: [{ type: 'text' as const, text: JSON.stringify(bundle, null, 2) }] }
    }
  )

  // ─── resolve_field ────────────────────────────────────────────────────────
  server.tool(
    'resolve_field',
    'Resolve a business term to the specific database field or API field used by this organization.',
    {
      concept: z.string().describe("Business term e.g. 'ARR', 'close date', 'account owner'"),
      object_hint: z.string().optional().describe("Object context e.g. 'Opportunity'"),
      connector_hint: z.string().optional().describe("Connector e.g. 'salesforce'"),
    },
    async ({ concept, object_hint, connector_hint }) => {
      const field = await fieldResolver.resolve(concept, orgId, {
        objectHint: object_hint,
        connectorHint: connector_hint,
      })

      if (!field) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              concept,
              found: false,
              message: 'No matching field found. Connect a system and run a sync to populate the field dictionary.',
            }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            concept,
            found: true,
            fieldName: field.fieldName,
            fieldLabel: field.fieldLabel,
            isPreferred: field.isPreferred,
            usageNote: field.usageNote,
            alternatives: field.alternatives,
            disambiguationNote: field.disambiguationNote,
          }),
        }],
      }
    }
  )

  // ─── get_metric_definition ────────────────────────────────────────────────
  server.tool(
    'get_metric_definition',
    'Get the complete definition of a business metric, including its calculation, filters, and field names. Returns the version active on the requested date.',
    {
      metric_name: z.string().describe('Name of the metric e.g. ARR, Bookings, NRR'),
      as_of_date: z.string().optional().describe('ISO 8601 date — returns version active on this date'),
    },
    async ({ metric_name, as_of_date }) => {
      const asOfDate = as_of_date ? new Date(as_of_date) : new Date()
      const result = await metricResolver.resolveByName(metric_name, orgId, asOfDate)

      if (!result) {
        // Try semantic fallback
        const metricRepo = new MetricRepo(fastify.db)
        const all = await metricRepo.listByOrg(orgId)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              found: false,
              error: `No metric named "${metric_name}" found in this org's dictionary.`,
              available: all.map((m) => ({ name: m.name, aliases: m.aliases })),
            }),
          }],
        }
      }

      if (!result.version) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              found: true,
              name: result.metric.name,
              error: `Metric exists but has no version active on ${asOfDate.toISOString().split('T')[0]}`,
            }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            found: true,
            name: result.metric.name,
            aliases: result.metric.aliases,
            category: result.metric.category,
            version: result.version.versionNumber,
            effectiveFrom: result.version.effectiveFrom.toISOString().split('T')[0],
            effectiveTo: result.version.effectiveTo?.toISOString().split('T')[0] ?? null,
            definition: result.version.definition,
            notes: result.version.notes,
            changedRecently: result.changedRecently,
            changeNote: result.changeNote,
          }),
        }],
      }
    }
  )

  // ─── generate_sql ─────────────────────────────────────────────────────────
  server.tool(
    'generate_sql',
    'Generate org-specific SQL for a GTM analysis using correct field names, mandatory filters, and business rules.',
    {
      intent: z.string().describe('What to calculate e.g. "Q1 bookings by region"'),
      target_connector: z.enum(['salesforce', 'snowflake', 'bigquery', 'redshift']).default('salesforce'),
      period_start: z.string().optional().describe('Start date YYYY-MM-DD'),
      period_end: z.string().optional().describe('End date YYYY-MM-DD'),
      segment_by: z.string().optional().describe('Field name to group results by'),
      as_of_date: z.string().optional().describe('Date for metric definition lookup'),
    },
    async ({ intent, target_connector, period_start, period_end, segment_by, as_of_date }) => {
      const asOfDate = as_of_date ? new Date(as_of_date) : new Date()

      // Resolve the metric the intent refers to
      const metricResult = await metricResolver.resolveBySemantic(intent, orgId, asOfDate)

      if (!metricResult?.version) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              generated: false,
              error: 'Could not identify a metric for this intent. Make sure you have accepted at least one report analysis to create metric definitions.',
              intent,
            }),
          }],
        }
      }

      // Get applicable business rules
      const rawRules = await ruleEngine.getApplicable(
        orgId,
        { metricId: metricResult.metric.id },
        asOfDate
      )
      const appliedRules = ruleEngine.toApplied(rawRules)

      let generated
      if (period_start && period_end) {
        const versionsInRange = await metricResolver.getVersionsInRange(
          metricResult.metric.id,
          new Date(period_start),
          new Date(period_end)
        )
        if (versionsInRange.length > 1) {
          const segments = versionsInRange.map((v, i) => ({
            version: v,
            periodStart: i === 0 ? period_start : v.effectiveFrom.toISOString().split('T')[0],
            periodEnd: v.effectiveTo ? v.effectiveTo.toISOString().split('T')[0] : period_end,
          }))
          generated = sqlGen.generateUnion(segments, appliedRules, target_connector)
        } else {
          generated = sqlGen.generate(metricResult.version, appliedRules, { periodStart: period_start, periodEnd: period_end, segment: segment_by }, target_connector)
        }
      } else {
        generated = sqlGen.generate(metricResult.version, appliedRules, { segment: segment_by }, target_connector)
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            generated: true,
            metric: metricResult.metric.name,
            definitionVersion: metricResult.version.versionNumber,
            sql: generated.sql,
            fieldsUsed: generated.fieldsUsed,
            rulesApplied: generated.rulesApplied,
            warnings: [...generated.warnings, ...(metricResult.changeNote ? [metricResult.changeNote] : [])],
          }),
        }],
      }
    }
  )

  return server
}
