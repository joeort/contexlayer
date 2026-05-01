import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ApiKeyRepo } from '@context-layer/database'
import { generateApiKey, hashApiKey } from '@context-layer/shared'
import { requireAuth } from '../../plugins/auth.js'

export async function apiKeyRoutes(fastify: FastifyInstance) {
  // List all API keys for the org (no secrets returned)
  fastify.get(
    '/api-keys',
    { preHandler: requireAuth },
    async (request) => {
      const { orgId } = request.auth!
      const repo = new ApiKeyRepo(fastify.db)
      return repo.listByOrg(orgId)
    }
  )

  // Create a new API key — returns the plain key exactly once
  fastify.post<{ Body: { name: string } }>(
    '/api-keys',
    {
      preHandler: requireAuth,
      schema: {
        body: z.object({ name: z.string().min(1).max(100) }),
      },
    },
    async (request, reply) => {
      const { orgId, userId } = request.auth!
      const { name } = request.body
      const repo = new ApiKeyRepo(fastify.db)

      const { key, hash, prefix } = generateApiKey(orgId)
      const created = await repo.create(orgId, name, hash, prefix, userId)

      return reply.status(201).send({
        ...created,
        // Return the plain key only on creation — it will never be shown again
        plainKey: key,
      })
    }
  )

  // Revoke a key
  fastify.delete<{ Params: { id: string } }>(
    '/api-keys/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { orgId } = request.auth!
      const repo = new ApiKeyRepo(fastify.db)
      const deleted = await repo.revoke(request.params.id, orgId)
      if (!deleted) return reply.status(404).send({ error: 'Key not found' })
      return reply.status(204).send()
    }
  )
}
