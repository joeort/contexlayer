import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { getPool } from '@context-layer/database'

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof getPool>
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const pool = getPool()
  fastify.decorate('db', pool)
  fastify.addHook('onClose', async () => {
    await pool.end()
  })
}

export default fp(databasePlugin, { name: 'database' })
