import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ConnectorRepo } from '@context-layer/database'
import { requireAuth } from '../../plugins/auth.js'
import { salesforceOAuthRoutes } from './salesforce-oauth.js'
import { hubspotOAuthRoutes } from './hubspot-oauth.js'
import { snowflakeRoutes } from './snowflake.js'
import { gongRoutes } from './gong.js'

const createSchema = z.object({
  type: z.string(),
  displayName: z.string().min(1),
  config: z.record(z.unknown()).default({}),
})

export async function connectorRoutes(fastify: FastifyInstance) {
  await fastify.register(salesforceOAuthRoutes)
  await fastify.register(hubspotOAuthRoutes)
  await fastify.register(snowflakeRoutes)
  await fastify.register(gongRoutes)

  // List connectors for org
  fastify.get('/connectors', { preHandler: requireAuth }, async (request) => {
    const repo = new ConnectorRepo(fastify.db)
    return repo.listByOrg(request.auth!.orgId)
  })

  // Get connector detail
  fastify.get<{ Params: { id: string } }>(
    '/connectors/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = new ConnectorRepo(fastify.db)
      const connector = await repo.getById(request.params.id, request.auth!.orgId)
      if (!connector) return reply.status(404).send({ message: 'Connector not found' })
      return connector
    }
  )

  // Create connector
  fastify.post('/connectors', { preHandler: requireAuth }, async (request, reply) => {
    const body = createSchema.parse(request.body)
    const repo = new ConnectorRepo(fastify.db)
    const connector = await repo.create(request.auth!.orgId, body)
    return reply.status(201).send(connector)
  })

  // Trigger manual sync
  fastify.post<{ Params: { id: string } }>(
    '/connectors/:id/sync',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { ConnectorSyncQueue } = await import('../../queues/index.js')
      const repo = new ConnectorRepo(fastify.db)
      const connector = await repo.getById(request.params.id, request.auth!.orgId)
      if (!connector) return reply.status(404).send({ message: 'Connector not found' })

      await ConnectorSyncQueue.add(
        `sync:${connector.id}`,
        {
          orgId: request.auth!.orgId,
          connectorId: connector.id,
          connectorType: connector.type,
          jobType: 'schema_crawl',
        },
        { jobId: `sync:${connector.id}`, removeOnComplete: 100, removeOnFail: 50 }
      )

      return reply.status(202).send({ message: 'Sync queued', connectorId: connector.id })
    }
  )
}
