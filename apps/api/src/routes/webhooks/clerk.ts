import type { FastifyInstance } from 'fastify'

// Clerk sends org.created and user.created webhooks so we can provision rows
export async function clerkWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/clerk', async (request, reply) => {
    const event = request.body as { type: string; data: Record<string, unknown> }

    if (event.type === 'organization.created') {
      const { id, slug, name } = event.data as {
        id: string
        slug: string
        name: string
      }
      await fastify.db.query(
        `INSERT INTO organizations (id, slug, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [id, slug ?? id, name]
      )
    }

    return reply.status(200).send({ received: true })
  })
}
