import { randomBytes, createHash } from 'crypto'

export interface GeneratedKey {
  /** Plain key — shown to user exactly once, never stored */
  key: string
  /** SHA-256 of the plain key — stored in DB */
  hash: string
  /** First 20 chars + ellipsis — safe to display in UI */
  prefix: string
}

/**
 * Generate a new API key for an org.
 * Format: cl_{env}_{8-char-org-prefix}_{32-hex-random}
 * Total length: ~47 chars, 128 bits of entropy.
 */
export function generateApiKey(orgId: string, env: 'live' | 'test' = 'live'): GeneratedKey {
  const orgPrefix = orgId.replace(/-/g, '').slice(0, 8)
  const secret = randomBytes(16).toString('hex')
  const key = `cl_${env}_${orgPrefix}_${secret}`
  const hash = hashApiKey(key)
  const prefix = `${key.slice(0, 20)}...`
  return { key, hash, prefix }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}
