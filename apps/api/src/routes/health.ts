import type { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {}

    // DB check
    try {
      await fastify.db.query('SELECT 1')
      checks.database = 'ok'
    } catch {
      checks.database = 'error'
    }

    const allOk = Object.values(checks).every((v) => v === 'ok')
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'degraded',
      checks,
      version: process.env.npm_package_version ?? '0.1.0',
    })
  })
}
