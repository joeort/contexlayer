import type { IConnector, ConnectorCrawlContext } from './registry.js'
import type { FieldRepo } from '@context-layer/database'

const GONG_API = 'https://us-11211.api.gong.io/v2'

// Gong has a fixed schema — calls, transcripts, deals, users, trackers
// We enumerate the known objects statically and supplement with CRM field schema
const STATIC_OBJECTS: Array<{
  name: string
  label: string
  fields: Array<{ name: string; label: string; type: string }>
}> = [
  {
    name: 'calls',
    label: 'Calls',
    fields: [
      { name: 'id', label: 'Call ID', type: 'text' },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'scheduled', label: 'Scheduled Time', type: 'datetime' },
      { name: 'started', label: 'Start Time', type: 'datetime' },
      { name: 'duration', label: 'Duration (seconds)', type: 'number' },
      { name: 'direction', label: 'Direction', type: 'picklist' },
      { name: 'language', label: 'Language', type: 'text' },
      { name: 'primaryUserId', label: 'Primary User ID', type: 'text' },
      { name: 'meetingUrl', label: 'Meeting URL', type: 'text' },
      { name: 'isPrivate', label: 'Is Private', type: 'boolean' },
    ],
  },
  {
    name: 'call_transcripts',
    label: 'Call Transcripts',
    fields: [
      { name: 'callId', label: 'Call ID', type: 'text' },
      { name: 'speakerId', label: 'Speaker ID', type: 'text' },
      { name: 'speakerName', label: 'Speaker Name', type: 'text' },
      { name: 'topic', label: 'Topic', type: 'text' },
      { name: 'sentences', label: 'Sentences', type: 'text' },
    ],
  },
  {
    name: 'deals',
    label: 'Deals (CRM-linked)',
    fields: [
      { name: 'crmId', label: 'CRM Deal ID', type: 'text' },
      { name: 'title', label: 'Deal Title', type: 'text' },
      { name: 'stage', label: 'Stage', type: 'picklist' },
      { name: 'closeDate', label: 'Close Date', type: 'date' },
      { name: 'amount', label: 'Amount', type: 'currency' },
      { name: 'callCount', label: 'Call Count', type: 'number' },
      { name: 'lastActivityDate', label: 'Last Activity Date', type: 'datetime' },
    ],
  },
  {
    name: 'users',
    label: 'Users',
    fields: [
      { name: 'id', label: 'User ID', type: 'text' },
      { name: 'firstName', label: 'First Name', type: 'text' },
      { name: 'lastName', label: 'Last Name', type: 'text' },
      { name: 'emailAddress', label: 'Email', type: 'text' },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'managerId', label: 'Manager ID', type: 'text' },
    ],
  },
  {
    name: 'trackers',
    label: 'Topic Trackers',
    fields: [
      { name: 'id', label: 'Tracker ID', type: 'text' },
      { name: 'name', label: 'Tracker Name', type: 'text' },
      { name: 'type', label: 'Type', type: 'picklist' },
      { name: 'phrases', label: 'Phrases', type: 'text' },
      { name: 'count', label: 'Mention Count', type: 'number' },
    ],
  },
]

export class GongConnector implements IConnector {
  async crawlSchema(ctx: ConnectorCrawlContext): Promise<void> {
    const { orgId, connectorId, credentials, fieldRepo } = ctx
    const basicAuth = getBasicAuth(credentials)

    // Upsert static schema objects
    for (const obj of STATIC_OBJECTS) {
      const schemaObj = await fieldRepo.upsertObject(orgId, connectorId, {
        objectName: obj.name,
        objectLabel: obj.label,
        objectType: 'standard',
        recordCount: null,
        metadata: { source: 'gong' },
      })

      for (const field of obj.fields) {
        await fieldRepo.upsertField(orgId, connectorId, schemaObj.id, {
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type as import('@context-layer/shared').FieldType,
          isCustom: false,
          formula: null,
          metadata: { source: 'gong-static' },
          sampleValues: null,
          nullRate: null,
        })
      }
    }

    // Also fetch dynamic CRM field schema if available
    try {
      await crawlCrmSchema(basicAuth, orgId, connectorId, fieldRepo)
    } catch (err) {
      console.warn('[gong] CRM schema fetch failed — static schema only:', err)
    }

    console.log(`[gong] schema crawl complete for org ${orgId}`)
  }
}

async function crawlCrmSchema(
  basicAuth: string,
  orgId: string,
  connectorId: string,
  fieldRepo: FieldRepo
): Promise<void> {
  const res = await gongFetch('/crm/schema/fields', basicAuth) as {
    requestId: string
    fields?: Array<{ name: string; label: string; type: string; objectType: string }>
  }

  if (!res.fields?.length) return

  const byObject = new Map<string, typeof res.fields>()
  for (const field of res.fields) {
    if (!byObject.has(field.objectType)) byObject.set(field.objectType, [])
    byObject.get(field.objectType)!.push(field)
  }

  for (const [objectType, fields] of byObject) {
    const schemaObj = await fieldRepo.upsertObject(orgId, connectorId, {
      objectName: `crm_${objectType}`,
      objectLabel: `CRM ${objectType}`,
      objectType: 'custom',
      recordCount: null,
      metadata: { source: 'gong-crm', objectType },
    })

    for (const field of fields) {
      await fieldRepo.upsertField(orgId, connectorId, schemaObj.id, {
        fieldName: field.name,
        fieldLabel: field.label ?? field.name,
        fieldType: mapGongType(field.type),
        isCustom: true,
        formula: null,
        metadata: { gongType: field.type, source: 'gong-crm' },
        sampleValues: null,
        nullRate: null,
      })
    }
  }
}

async function gongFetch(path: string, basicAuth: string): Promise<unknown> {
  const res = await fetch(`${GONG_API}${path}`, {
    headers: { Authorization: `Basic ${basicAuth}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gong API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

function getBasicAuth(credentials: Record<string, unknown>): string {
  const accessKey = credentials.accessKey as string
  const accessKeySecret = credentials.accessKeySecret as string
  if (!accessKey || !accessKeySecret) {
    throw new Error('Gong credentials missing accessKey or accessKeySecret')
  }
  return Buffer.from(`${accessKey}:${accessKeySecret}`).toString('base64')
}

function mapGongType(type: string): import('@context-layer/shared').FieldType {
  const map: Record<string, import('@context-layer/shared').FieldType> = {
    STRING: 'text',
    NUMBER: 'number',
    CURRENCY: 'currency',
    BOOLEAN: 'boolean',
    DATE: 'date',
    DATETIME: 'datetime',
    PICKLIST: 'picklist',
    MULTIPICKLIST: 'multipicklist',
  }
  return map[type.toUpperCase()] ?? 'unknown'
}
