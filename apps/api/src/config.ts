import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.string().optional(),
  REDIS_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  MEILISEARCH_URL: z.string().default('http://localhost:7700'),
  MEILISEARCH_MASTER_KEY: z.string().default('dev_master_key_change_in_prod'),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  WEB_URL: z.string().default('http://localhost:3000'),
  OPENAI_API_KEY: z.string().default(''),
  SALESFORCE_CLIENT_ID: z.string().min(1),
  SALESFORCE_CLIENT_SECRET: z.string().min(1),
  SALESFORCE_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/connectors/salesforce/callback'),

  // HubSpot OAuth — optional; routes return 501 if not configured
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/connectors/hubspot/callback'),

  // Clerk webhook signing secret (from Clerk Dashboard → Webhooks)
  CLERK_WEBHOOK_SECRET: z.string().optional(),
})

function loadConfig() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:')
    for (const [key, issues] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`  ${key}: ${issues?.join(', ')}`)
    }
    process.exit(1)
  }
  return result.data
}

export const config = loadConfig()
export type Config = typeof config
