import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { Redis } from '@upstash/redis'
import { config } from '../config.js'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis({ url: config.REDIS_URL, token: '' })
  fastify.decorate('redis', redis)
}

export default fp(redisPlugin, { name: 'redis' })
