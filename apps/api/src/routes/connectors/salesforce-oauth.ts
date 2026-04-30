import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { ConnectorRepo } from '@context-layer/database'
import { encryptCredentials } from '@context-layer/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'

const SF_AUTH_BASE = 'https://login.salesforce.com'
const OAUTH_STATE_TTL = 600 // 10 minutes

interface SalesforceTokenResponse {
  access_token: string
  refresh_token: string
  instance_url: string
  id: string
  issued_at: string
  token_type: string
}

export async function salesforceOAuthRoutes(fastify: FastifyInstance) {
  // Step 1: Initiate OAuth — returns the Salesforce authorization URL
  fastify.get(
    '/connectors/salesforce/authorize',
    { preHandler: requireAuth },
    async (request) => {
      const { orgId } = request.auth!
      const state = randomUUID()

      // Store state → orgId in Redis for callback verification
      await fastify.redis.set(
        `oauth:state:${state}`,
        orgId,
        { ex: OAUTH_STATE_TTL }
      )

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.SALESFORCE_CLIENT_ID,
        redirect_uri: config.SALESFORCE_REDIRECT_URI,
        state,
        scope: 'api refresh_token offline_access',
        prompt: 'login consent',
      })

      return { authUrl: `${SF_AUTH_BASE}/services/oauth2/authorize?${params}` }
    }
  )

  // Step 2: OAuth callback — Salesforce redirects here after user authorizes
  fastify.get<{ Querystring: { code?: string; state?: string; error?: string; error_description?: string } }>(
    '/connectors/salesforce/callback',
    async (request, reply) => {
      const { code, state, error, error_description } = request.query

      const webUrl = config.WEB_URL

      if (error || !code || !state) {
        const msg = error_description ?? error ?? 'Authorization cancelled'
        return reply.redirect(`${webUrl}/dashboard/connectors/new/salesforce?error=${encodeURIComponent(msg)}`)
      }

      // Verify state and recover orgId
      const orgId = await fastify.redis.get(`oauth:state:${state}`)
      if (!orgId) {
        return reply.redirect(
          `${webUrl}/dashboard/connectors/new/salesforce?error=${encodeURIComponent('OAuth session expired. Please try again.')}`
        )
      }
      await fastify.redis.del(`oauth:state:${state}`)

      // Exchange authorization code for tokens
      let tokens: SalesforceTokenResponse
      try {
        const tokenRes = await fetch(`${SF_AUTH_BASE}/services/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: config.SALESFORCE_CLIENT_ID,
            client_secret: config.SALESFORCE_CLIENT_SECRET,
            redirect_uri: config.SALESFORCE_REDIRECT_URI,
          }),
        })
        if (!tokenRes.ok) {
          const err = await tokenRes.text()
          fastify.log.error({ err }, 'Salesforce token exchange failed')
          throw new Error('Token exchange failed')
        }
        tokens = (await tokenRes.json()) as SalesforceTokenResponse
      } catch (err) {
        fastify.log.error(err, 'Salesforce OAuth token exchange error')
        return reply.redirect(
          `${webUrl}/dashboard/connectors/new/salesforce?error=${encodeURIComponent('Failed to connect to Salesforce. Please try again.')}`
        )
      }

      // Derive a display name from the instance URL (e.g. "mycompany.my.salesforce.com" → "Salesforce")
      const displayName = 'Salesforce'

      // Create the connector record
      const repo = new ConnectorRepo(fastify.db)
      const connector = await repo.create(orgId, {
        type: 'salesforce',
        displayName,
        config: { instanceUrl: tokens.instance_url },
      })

      // Encrypt and store credentials — never stored plain
      const encrypted = encryptCredentials(
        {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          instanceUrl: tokens.instance_url,
          issuedAt: tokens.issued_at,
        },
        config.CREDENTIAL_ENCRYPTION_KEY
      )
      await repo.setCredentials(connector.id, { encrypted })

      // Mark connector as pending (sync will set it to active)
      await repo.setStatus(connector.id, 'pending')

      // Queue schema crawl immediately
      const { ConnectorSyncQueue } = await import('../../queues/index.js')
      await ConnectorSyncQueue.add(
        `sync:${connector.id}`,
        {
          orgId,
          connectorId: connector.id,
          connectorType: 'salesforce',
          jobType: 'schema_crawl',
        },
        { jobId: `sync:${connector.id}`, removeOnComplete: 100, removeOnFail: 50 }
      )

      fastify.log.info({ connectorId: connector.id, orgId }, 'Salesforce connector created, sync queued')

      return reply.redirect(`${webUrl}/dashboard/connectors/${connector.id}?setup=complete`)
    }
  )
}
