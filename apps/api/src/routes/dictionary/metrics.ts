import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MetricRepo } from '@context-layer/database'
import { requireAuth } from '../../plugins/auth.js'

const createMetricSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
  category: z.enum(['revenue','pipeline','activity','product','finance','marketing','customer_success']).optional(),
})

const addVersionSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  definition: z.record(z.unknown()),
  notes: z.string().nullable().optional(),
  source: z.enum(['manual','report_analysis','llm_inference']).default('manual'),
  sourceRef: z.string().nullable().optional(),
})

export async function metricRoutes(fastify: FastifyInstance) {
  fastify.get('/metrics', { preHandler: requireAuth }, async (request) => {
    const { status } = request.query as { status?: string }
    const repo = new MetricRepo(fastify.db)
    return repo.listByOrg(request.auth!.orgId, status as any)
  })

  fastify.get<{ Params: { id: string } }>(
    '/metrics/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = new MetricRepo(fastify.db)
      const metric = await repo.getById(request.params.id, request.auth!.orgId)
      if (!metric) return reply.status(404).send({ message: 'Metric not found' })
      return metric
    }
  )

  fastify.post('/metrics', { preHandler: requireAuth }, async (request, reply) => {
    const body = createMetricSchema.parse(request.body)
    const repo = new MetricRepo(fastify.db)
    const metric = await repo.create(request.auth!.orgId, body)
    return reply.status(201).send(metric)
  })

  fastify.get<{ Params: { id: string } }>(
    '/metrics/:id/versions',
    { preHandler: requireAuth },
    async (request) => {
      const repo = new MetricRepo(fastify.db)
      return repo.listVersions(request.params.id)
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/metrics/:id/versions',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = addVersionSchema.parse(request.body)
      const repo = new MetricRepo(fastify.db)
      const version = await repo.addVersion(request.params.id, request.auth!.orgId, {
        effectiveFrom: new Date(body.effectiveFrom),
        definition: body.definition as any,
        notes: body.notes ?? null,
        source: body.source,
        sourceRef: body.sourceRef ?? null,
      })
      return reply.status(201).send(version)
    }
  )
}
