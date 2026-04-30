import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FieldRepo } from '@context-layer/database'
import { requireAuth } from '../../plugins/auth.js'

const annotationSchema = z.object({
  description: z.string().nullable().optional(),
  usageNotes: z.string().nullable().optional(),
  isPreferred: z.boolean().default(false),
  replacesFieldId: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
})

export async function fieldRoutes(fastify: FastifyInstance) {
  // List objects for org (or specific connector)
  fastify.get('/fields/objects', { preHandler: requireAuth }, async (request) => {
    const { connectorId } = request.query as { connectorId?: string }
    const repo = new FieldRepo(fastify.db)
    return repo.listObjects(request.auth!.orgId, connectorId)
  })

  // List fields for an object
  fastify.get<{ Params: { objectId: string } }>(
    '/fields/objects/:objectId/fields',
    { preHandler: requireAuth },
    async (request) => {
      const repo = new FieldRepo(fastify.db)
      return repo.listFields(request.auth!.orgId, request.params.objectId)
    }
  )

  // Update field annotation (description, usage notes, preferred flag)
  fastify.patch<{ Params: { id: string } }>(
    '/fields/:id/annotations',
    { preHandler: requireAuth },
    async (request) => {
      const body = annotationSchema.parse(request.body)
      const repo = new FieldRepo(fastify.db)
      return repo.setAnnotation(
        request.auth!.orgId,
        request.params.id,
        {
          description: body.description ?? null,
          usageNotes: body.usageNotes ?? null,
          isPreferred: body.isPreferred,
          replacesFieldId: body.replacesFieldId ?? null,
          confidence: body.confidence ?? null,
        },
        request.auth!.userId
      )
    }
  )
}
