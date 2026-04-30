import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { createClerkClient } from '@clerk/backend'
import { config } from '../config.js'

const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY })

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      userId: string
      orgId: string
      orgSlug: string | null
      role: string | null
    } | null
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('auth', null)

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) return

    try {
      const payload = await clerk.verifyToken(token)
      request.auth = {
        userId: payload.sub,
        orgId: (payload.org_id as string) ?? '',
        orgSlug: (payload.org_slug as string) ?? null,
        role: (payload.org_role as string) ?? null,
      }
    } catch {
      // Invalid token — leave auth as null; routes requiring auth will 401
    }
  })
}

export default fp(authPlugin, { name: 'auth' })

// Route-level guard: require valid Clerk JWT with an org
export async function requireAuth(request: FastifyRequest) {
  if (!request.auth?.userId) {
    throw { statusCode: 401, message: 'Authentication required' }
  }
  if (!request.auth.orgId) {
    throw { statusCode: 403, message: 'Organization context required' }
  }
}
