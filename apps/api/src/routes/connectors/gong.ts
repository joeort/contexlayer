import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ConnectorRepo } from '@context-layer/database'
import { encryptCredentials } from '@context-layer/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'

const connectSchema = z.object({
  accessKey: z.string().min(1).describe('Gong API access key'),
  accessKeySecret: z.string().min(1).describe('Gong API access key secret'),
  displayName: z.string().default('Gong'),
})

export async function gongRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/connectors/gong/connect',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = connectSchema.parse(request.body)
      const { orgId } = request.auth!

      // Validate credentials by hitting the Gong users endpoint
      const basicAuth = Buffer.from(`${body.accessKey}:${body.accessKeySecret}`).toString('base64')
      const testRes = await fetch('https://us-11211.api.gong.io/v2/users?cursor=&limit=1', {
        headers: { Authorization: `Basic ${basicAuth}` },
      })
      if (!testRes.ok) {
        return reply.status(400).send({ error: 'Invalid Gong credentials. Please check your access key and secret.' })
      }

      const repo = new ConnectorRepo(fastify.db)
      const connector = await repo.create(orgId, {
        type: 'gong',
        displayName: body.displayName,
        config: {},
      })

      const encrypted = encryptCredentials(
        { accessKey: body.accessKey, accessKeySecret: body.accessKeySecret },
        config.CREDENTIAL_ENCRYPTION_KEY
      )
      await repo.setCredentials(connector.id, { encrypted })
      await repo.setStatus(connector.id, 'pending')

      const { ConnectorSyncQueue } = await import('../../queues/index.js')
      await ConnectorSyncQueue.add(
        `sync:${connector.id}`,
        { orgId, connectorId: connector.id, connectorType: 'gong', jobType: 'schema_crawl' },
        { jobId: `sync:${connector.id}`, removeOnComplete: 100, removeOnFail: 50 }
      )

      fastify.log.info({ connectorId: connector.id, orgId }, 'Gong connector created, sync queued')

      return reply.status(201).send({ connectorId: connector.id })
    }
  )
}
