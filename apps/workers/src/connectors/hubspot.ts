import type { IConnector, ConnectorCrawlContext } from './registry.js'
import type { FieldRepo } from '@context-layer/database'

const HS_API = 'https://api.hubapi.com'
const HS_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'

// Standard CRM objects to crawl properties for
const CRAWL_OBJECTS = ['contacts', 'deals', 'companies', 'tickets', 'line_items', 'products'] as const

interface HubSpotProperty {
  name: string
  label: string
  type: string
  fieldType: string
  description: string
  groupName: string
  calculated: boolean
  hidden: boolean
  options?: Array<{ value: string; label: string }>
}

interface HubSpotPropertiesResponse {
  results: HubSpotProperty[]
}

interface HubSpotTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export class HubSpotConnector implements IConnector {
  async crawlSchema(ctx: ConnectorCrawlContext): Promise<void> {
    const { orgId, connectorId, credentials, fieldRepo } = ctx
    const accessToken = await getAccessToken(credentials)

    for (const objectType of CRAWL_OBJECTS) {
      try {
        await crawlObjectProperties(objectType, accessToken, orgId, connectorId, fieldRepo)
      } catch (err) {
        console.warn(`[hubspot] failed to crawl ${objectType}:`, err)
      }
    }

    console.log(`[hubspot] schema crawl complete for org ${orgId}`)
  }
}

async function crawlObjectProperties(
  objectType: string,
  accessToken: string,
  orgId: string,
  connectorId: string,
  fieldRepo: FieldRepo
): Promise<void> {
  const res = await hsFetch(
    `${HS_API}/crm/v3/properties/${objectType}?archived=false`,
    accessToken
  ) as HubSpotPropertiesResponse

  const properties = res.results ?? []
  const visible = properties.filter((p) => !p.hidden)

  console.log(`[hubspot] ${objectType}: ${visible.length} properties`)

  const schemaObj = await fieldRepo.upsertObject(orgId, connectorId, {
    objectName: objectType,
    objectLabel: capitalize(objectType),
    objectType: 'standard',
    recordCount: null,
    metadata: { source: 'hubspot' },
  })

  for (const prop of visible) {
    await fieldRepo.upsertField(orgId, connectorId, schemaObj.id, {
      fieldName: prop.name,
      fieldLabel: prop.label,
      fieldType: mapHubSpotType(prop.type, prop.calculated),
      isCustom: !isBuiltIn(prop.groupName),
      formula: null,
      metadata: {
        fieldType: prop.fieldType,
        groupName: prop.groupName,
        description: prop.description,
        options: prop.options?.slice(0, 50) ?? [],
      },
      sampleValues: null,
      nullRate: null,
    })
  }
}

// HubSpot access tokens expire in 30 minutes — refresh at crawl start
async function getAccessToken(credentials: Record<string, unknown>): Promise<string> {
  const clientId = process.env.HUBSPOT_CLIENT_ID
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET

  // If we have a refresh token and client creds, get a fresh access token
  if (credentials.refreshToken && clientId && clientSecret) {
    try {
      const res = await fetch(HS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: credentials.refreshToken as string,
        }),
      })
      if (res.ok) {
        const tokens = (await res.json()) as HubSpotTokenResponse
        return tokens.access_token
      }
    } catch (err) {
      console.warn('[hubspot] token refresh failed, falling back to stored token:', err)
    }
  }

  const accessToken = credentials.accessToken as string
  if (!accessToken) throw new Error('HubSpot credentials missing accessToken')
  return accessToken
}

async function hsFetch(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

function mapHubSpotType(type: string, calculated: boolean): import('@context-layer/shared').FieldType {
  if (calculated) return 'formula'
  const map: Record<string, import('@context-layer/shared').FieldType> = {
    string: 'text',
    number: 'number',
    date: 'date',
    datetime: 'datetime',
    bool: 'boolean',
    enumeration: 'picklist',
    phone_number: 'text',
    object_coordinates: 'text',
    json: 'text',
    currency: 'currency',
  }
  return map[type] ?? 'unknown'
}

function isBuiltIn(groupName: string): boolean {
  const builtInGroups = [
    'contactinformation', 'dealinformation', 'companyinformation',
    'ticketinformation', 'lineiteminformation', 'productinformation',
    'social_media_information', 'email_information',
  ]
  return builtInGroups.includes(groupName.toLowerCase())
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
