import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ConnectorRepo } from '@context-layer/database'
import { encryptCredentials } from '@context-layer/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'

const connectSchema = z.object({
  account: z.string().min(1).describe('Snowflake account identifier, e.g. xy12345.us-east-1'),
  username: z.string().min(1),
  password: z.string().min(1),
  warehouse: z.string().min(1),
  database: z.string().min(1),
  schema: z.string().default('PUBLIC'),
  displayName: z.string().default('Snowflake'),
})

export async function snowflakeRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/connectors/snowflake/connect',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = connectSchema.parse(request.body)
      const { orgId } = request.auth!

      const repo = new ConnectorRepo(fastify.db)
      const connector = await repo.create(orgId, {
        type: 'snowflake',
        displayName: body.displayName,
        config: { account: body.account, warehouse: body.warehouse, database: body.database },
      })

      const encrypted = encryptCredentials(
        {
          account: body.account,
          username: body.username,
          password: body.password,
          warehouse: body.warehouse,
          database: body.database,
          schema: body.schema,
        },
        config.CREDENTIAL_ENCRYPTION_KEY
      )
      await repo.setCredentials(connector.id, { encrypted })
      await repo.setStatus(connector.id, 'pending')

      const { ConnectorSyncQueue } = await import('../../queues/index.js')
      await ConnectorSyncQueue.add(
        `sync:${connector.id}`,
        { orgId, connectorId: connector.id, connectorType: 'snowflake', jobType: 'schema_crawl' },
        { jobId: `sync:${connector.id}`, removeOnComplete: 100, removeOnFail: 50 }
      )

      fastify.log.info({ connectorId: connector.id, orgId }, 'Snowflake connector created, sync queued')

      return reply.status(201).send({ connectorId: connector.id })
    }
  )
}
