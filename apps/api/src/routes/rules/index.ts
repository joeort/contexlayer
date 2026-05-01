import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BusinessRuleRepo } from '@context-layer/database'
import { requireAuth } from '../../plugins/auth.js'

const ruleSchema = z.object({
  ruleType: z.enum(['filter', 'join', 'exclusion', 'alias', 'nuance', 'temporal_change']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
  priority: z.number().int().min(0).max(100).default(50),
  appliesTo: z.object({
    metrics: z.array(z.string()).optional(),
    objects: z.array(z.string()).optional(),
    connectors: z.array(z.string()).optional(),
  }).default({}),
  structuredRule: z.record(z.unknown()).optional().nullable(),
})

export async function ruleRoutes(fastify: FastifyInstance) {
  // List all rules for the org
  fastify.get(
    '/rules',
    { preHandler: requireAuth },
    async (request) => {
      const { orgId } = request.auth!
      const repo = new BusinessRuleRepo(fastify.db)
      return repo.listAll(orgId)
    }
  )

  // Create a new rule
  fastify.post<{ Body: z.infer<typeof ruleSchema> }>(
    '/rules',
    {
      preHandler: requireAuth,
      schema: { body: ruleSchema },
    },
    async (request, reply) => {
      const { orgId } = request.auth!
      const { ruleType, title, description, effectiveFrom, effectiveTo, priority, appliesTo, structuredRule } = request.body
      const repo = new BusinessRuleRepo(fastify.db)
      const rule = await repo.create(orgId, {
        ruleType,
        title,
        description,
        appliesTo,
        structuredRule: structuredRule ?? null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        priority,
      })
      return reply.status(201).send(rule)
    }
  )

  // Deactivate a rule
  fastify.delete<{ Params: { id: string } }>(
    '/rules/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { orgId } = request.auth!
      const repo = new BusinessRuleRepo(fastify.db)
      const deleted = await repo.deactivate(request.params.id, orgId)
      if (!deleted) return reply.status(404).send({ error: 'Rule not found' })
      return reply.status(204).send()
    }
  )
}
