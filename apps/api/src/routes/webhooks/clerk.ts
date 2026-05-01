import type { FastifyInstance } from 'fastify'
import { Webhook } from 'svix'

export async function clerkWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/clerk', async (request, reply) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET
    if (secret) {
      const svixId = request.headers['svix-id'] as string
      const svixTs = request.headers['svix-timestamp'] as string
      const svixSig = request.headers['svix-signature'] as string

      if (!svixId || !svixTs || !svixSig) {
        return reply.status(400).send({ error: 'Missing Svix headers' })
      }

      try {
        const wh = new Webhook(secret)
        wh.verify(JSON.stringify(request.body), {
          'svix-id': svixId,
          'svix-timestamp': svixTs,
          'svix-signature': svixSig,
        })
      } catch {
        return reply.status(401).send({ error: 'Invalid webhook signature' })
      }
    } else {
      fastify.log.warn('CLERK_WEBHOOK_SECRET not set — webhook signature not verified')
    }

    const event = request.body as { type: string; data: Record<string, unknown> }

    if (event.type === 'organization.created') {
      const { id, slug, name } = event.data as { id: string; slug: string; name: string }
      await fastify.db.query(
        `INSERT INTO organizations (id, slug, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [id, slug ?? id, name]
      )
      fastify.log.info({ orgId: id }, 'Organization provisioned')
    }

    if (event.type === 'organization.deleted') {
      fastify.log.info({ orgId: event.data.id }, 'Organization deleted event received')
    }

    return reply.status(200).send({ received: true })
  })
}
