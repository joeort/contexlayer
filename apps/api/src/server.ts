import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fp from 'fastify-plugin'
import { config } from './config.js'
import databasePlugin from './plugins/database.js'
import authPlugin from './plugins/auth.js'
import redisPlugin from './plugins/redis.js'
import { healthRoutes } from './routes/health.js'
import { connectorRoutes } from './routes/connectors/index.js'
import { fieldRoutes } from './routes/dictionary/fields.js'
import { metricRoutes } from './routes/dictionary/metrics.js'
import { reportRoutes } from './routes/reports/index.js'
import { apiKeyRoutes } from './routes/api-keys/index.js'
import { ruleRoutes } from './routes/rules/index.js'
import { mcpRoutes } from './routes/mcp/index.js'
import { mcpTestRoutes } from './routes/mcp/test.js'
import { mcpRequestRoutes } from './routes/mcp/requests.js'
import { clerkWebhookRoutes } from './routes/webhooks/clerk.js'

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: config.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  await fastify.register(cors, {
    origin: config.CORS_ORIGINS.split(','),
    credentials: true,
  })

  await fastify.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      (req as any).auth?.orgId ?? req.ip,
  })

  // Plugins
  await fastify.register(databasePlugin)
  await fastify.register(redisPlugin)
  await fastify.register(authPlugin)

  // Routes
  await fastify.register(healthRoutes)
  await fastify.register(clerkWebhookRoutes)

  // API v1 prefix
  await fastify.register(
    async (api) => {
      await api.register(connectorRoutes)
      await api.register(fieldRoutes)
      await api.register(metricRoutes)
      await api.register(reportRoutes)
      await api.register(apiKeyRoutes)
      await api.register(mcpTestRoutes)
      await api.register(mcpRequestRoutes)
      await api.register(ruleRoutes)
    },
    { prefix: '/api/v1' }
  )

  // MCP server (no /api prefix — separate auth via x-api-key header)
  await fastify.register(mcpRoutes)

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = (error as any).statusCode ?? 500
    if (statusCode === 500) {
      fastify.log.error(error)
    }
    return reply.status(statusCode).send({
      error: error.message ?? 'Internal server error',
    })
  })

  return fastify
}

async function start() {
  const server = await buildServer()
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
