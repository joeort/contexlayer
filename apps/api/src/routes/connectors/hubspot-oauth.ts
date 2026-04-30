import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { ConnectorRepo } from '@context-layer/database'
import { encryptCredentials } from '@context-layer/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'

const HS_AUTH_BASE = 'https://app.hubspot.com'
const HS_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'
const OAUTH_STATE_TTL = 600 // 10 minutes

const HS_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.deals.read',
  'crm.objects.companies.read',
  'crm.schemas.contacts.read',
  'crm.schemas.deals.read',
  'crm.schemas.companies.read',
  'crm.objects.owners.read',
].join(' ')

interface HubSpotTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export async function hubspotOAuthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/connectors/hubspot/authorize',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!config.HUBSPOT_CLIENT_ID || !config.HUBSPOT_CLIENT_SECRET) {
        return reply.status(501).send({ error: 'HubSpot connector is not configured on this server' })
      }

      const { orgId } = request.auth!
      const state = randomUUID()

      await fastify.redis.set(`oauth:state:${state}`, orgId, { ex: OAUTH_STATE_TTL })

      const params = new URLSearchParams({
        client_id: config.HUBSPOT_CLIENT_ID,
        redirect_uri: config.HUBSPOT_REDIRECT_URI,
        scope: HS_SCOPES,
        state,
      })

      return { authUrl: `${HS_AUTH_BASE}/oauth/authorize?${params}` }
    }
  )

  fastify.get<{ Querystring: { code?: string; state?: string; error?: string; error_description?: string } }>(
    '/connectors/hubspot/callback',
    async (request, reply) => {
      const { code, state, error, error_description } = request.query
      const webUrl = config.WEB_URL

      if (error || !code || !state) {
        const msg = error_description ?? error ?? 'Authorization cancelled'
        return reply.redirect(`${webUrl}/dashboard/connectors/new/hubspot?error=${encodeURIComponent(msg)}`)
      }

      const orgId = await fastify.redis.get(`oauth:state:${state}`)
      if (!orgId) {
        return reply.redirect(
          `${webUrl}/dashboard/connectors/new/hubspot?error=${encodeURIComponent('OAuth session expired. Please try again.')}`
        )
      }
      await fastify.redis.del(`oauth:state:${state}`)

      let tokens: HubSpotTokenResponse
      try {
        const tokenRes = await fetch(HS_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.HUBSPOT_CLIENT_ID!,
            client_secret: config.HUBSPOT_CLIENT_SECRET!,
            redirect_uri: config.HUBSPOT_REDIRECT_URI,
            code,
          }),
        })
        if (!tokenRes.ok) {
          const err = await tokenRes.text()
          fastify.log.error({ err }, 'HubSpot token exchange failed')
          throw new Error('Token exchange failed')
        }
        tokens = (await tokenRes.json()) as HubSpotTokenResponse
      } catch (err) {
        fastify.log.error(err, 'HubSpot OAuth token exchange error')
        return reply.redirect(
          `${webUrl}/dashboard/connectors/new/hubspot?error=${encodeURIComponent('Failed to connect to HubSpot. Please try again.')}`
        )
      }

      const repo = new ConnectorRepo(fastify.db)
      const connector = await repo.create(orgId, {
        type: 'hubspot',
        displayName: 'HubSpot',
        config: {},
      })

      const encrypted = encryptCredentials(
        {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
        },
        config.CREDENTIAL_ENCRYPTION_KEY
      )
      await repo.setCredentials(connector.id, { encrypted })
      await repo.setStatus(connector.id, 'pending')

      const { ConnectorSyncQueue } = await import('../../queues/index.js')
      await ConnectorSyncQueue.add(
        `sync:${connector.id}`,
        { orgId, connectorId: connector.id, connectorType: 'hubspot', jobType: 'schema_crawl' },
        { jobId: `sync:${connector.id}`, removeOnComplete: 100, removeOnFail: 50 }
      )

      fastify.log.info({ connectorId: connector.id, orgId }, 'HubSpot connector created, sync queued')

      return reply.redirect(`${webUrl}/dashboard/connectors/${connector.id}?setup=complete`)
    }
  )
}
