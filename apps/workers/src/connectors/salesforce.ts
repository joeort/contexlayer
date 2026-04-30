import type { IConnector, ConnectorCrawlContext } from './registry.js'
import type { FieldRepo, ReportRepo } from '@context-layer/database'

const PRIORITY_KEYWORDS = ['ARR', 'Booking', 'Pipeline', 'Revenue', 'Forecast', 'NRR', 'Churn', 'Win', 'MQL', 'SQL']
const API_VERSION = 'v63.0'

interface SalesforceField {
  name: string
  label: string
  type: string
  custom: boolean
  calculated: boolean
  calculatedFormula: string | null
  picklistValues?: Array<{ value: string; label: string }>
  referenceTo?: string[]
  nillable: boolean
}

interface SalesforceObject {
  name: string
  label: string
  custom: boolean
}

interface SalesforceSoqlResponse<T> {
  totalSize: number
  done: boolean
  records: T[]
}

interface SalesforceReportRecord {
  Id: string
  Name: string
  Description: string | null
  FolderName: string | null
  Format: string
}

export class SalesforceConnector implements IConnector {
  async crawlSchema(ctx: ConnectorCrawlContext): Promise<void> {
    const { orgId, connectorId, credentials, fieldRepo } = ctx
    const { instanceUrl, accessToken } = getAuth(credentials)

    const objectsData = await sfFetch(
      `${instanceUrl}/services/data/${API_VERSION}/sobjects`,
      accessToken
    ) as { sobjects: SalesforceObject[] }

    const queryable = objectsData.sobjects.filter(
      (o) =>
        !o.name.startsWith('__') &&
        !/(Feed|History|Share|ChangeEvent|__mdt|__e)$/.test(o.name)
    )

    console.log(`[salesforce] crawling ${queryable.length} objects`)

    const BATCH_SIZE = 10
    for (let i = 0; i < queryable.length; i += BATCH_SIZE) {
      const batch = queryable.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map((obj) => crawlObject(obj, instanceUrl, accessToken, orgId, connectorId, fieldRepo))
      )
    }
  }

  async fetchReports(ctx: ConnectorCrawlContext): Promise<void> {
    const { orgId, connectorId, credentials, reportRepo } = ctx
    const { instanceUrl, accessToken } = getAuth(credentials)

    // SOQL to list all reports ordered by recency (most recently run first = most relevant)
    const soql = `SELECT Id, Name, Description, FolderName, Format FROM Report ORDER BY LastRunDate DESC NULLS LAST LIMIT 500`
    let records: SalesforceReportRecord[] = []
    try {
      const result = await sfFetch(
        `${instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`,
        accessToken
      ) as SalesforceSoqlResponse<SalesforceReportRecord>
      records = result.records ?? []
    } catch (err) {
      console.warn('[salesforce] report SOQL failed — skipping report discovery:', err)
      return
    }

    console.log(`[salesforce] discovered ${records.length} reports`)

    // Priority reports get full Analytics API describe (columns, filters, groupings)
    const isPriority = (r: SalesforceReportRecord) =>
      PRIORITY_KEYWORDS.some((kw) => r.Name.toLowerCase().includes(kw.toLowerCase()))
    const priority = records.filter(isPriority)
    const others = records.filter((r) => !isPriority(r))

    const priorityWithDescribes = await batchProcess(priority, 5, async (r) => {
      try {
        const describe = await sfFetch(
          `${instanceUrl}/services/data/${API_VERSION}/analytics/reports/${r.Id}/describe`,
          accessToken
        )
        return { record: r, definition: describe as Record<string, unknown> }
      } catch {
        return { record: r, definition: { soqlRow: r as unknown as Record<string, unknown> } }
      }
    })

    const allReports = [
      ...priorityWithDescribes,
      ...others.map((r) => ({ record: r, definition: { soqlRow: r as unknown as Record<string, unknown> } })),
    ]

    for (const { record, definition } of allReports) {
      try {
        await reportRepo.upsert(orgId, connectorId, {
          externalId: record.Id,
          name: record.Name,
          description: record.Description,
          reportType: mapReportFormat(record.Format),
          url: `${instanceUrl}/lightning/r/Report/${record.Id}/view`,
          rawDefinition: definition,
        })
      } catch (err) {
        console.warn(`[salesforce] failed to upsert report ${record.Id}:`, err)
      }
    }

    console.log(`[salesforce] upserted ${allReports.length} reports (${priority.length} with full definition)`)
  }
}

async function crawlObject(
  obj: SalesforceObject,
  instanceUrl: string,
  accessToken: string,
  orgId: string,
  connectorId: string,
  fieldRepo: FieldRepo
) {
  try {
    const describe = await sfFetch(
      `${instanceUrl}/services/data/${API_VERSION}/sobjects/${obj.name}/describe`,
      accessToken
    ) as { label: string; custom: boolean; fields: SalesforceField[] }

    const schemaObj = await fieldRepo.upsertObject(orgId, connectorId, {
      objectName: obj.name,
      objectLabel: describe.label,
      objectType: obj.custom ? 'custom' : 'standard',
      recordCount: null,
      metadata: { custom: obj.custom },
    })

    const importantFields = describe.fields.filter(
      (f) =>
        !['Id', 'IsDeleted', 'SystemModstamp', 'LastModifiedById', 'CreatedById'].includes(f.name) ||
        f.custom
    )

    for (const field of importantFields) {
      await fieldRepo.upsertField(orgId, connectorId, schemaObj.id, {
        fieldName: field.name,
        fieldLabel: field.label,
        fieldType: mapSalesforceType(field.type, field.calculated),
        isCustom: field.custom,
        formula: field.calculatedFormula,
        metadata: {
          nillable: field.nillable,
          picklistValues: field.picklistValues?.slice(0, 50) ?? [],
          referenceTo: field.referenceTo ?? [],
          sfType: field.type,
        },
        sampleValues: null,
        nullRate: null,
      })
    }
  } catch (err) {
    console.warn(`[salesforce] failed to crawl object ${obj.name}:`, err)
  }
}

function getAuth(credentials: Record<string, unknown>) {
  const instanceUrl = credentials.instanceUrl as string
  const accessToken = credentials.accessToken as string
  if (!instanceUrl || !accessToken) {
    throw new Error('Salesforce credentials missing instanceUrl or accessToken')
  }
  return { instanceUrl, accessToken }
}

async function sfFetch(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Salesforce API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    results.push(...(await Promise.all(batch.map(fn))))
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  return results
}

function mapReportFormat(format: string): import('@context-layer/shared').ReportType {
  const map: Record<string, import('@context-layer/shared').ReportType> = {
    Tabular: 'tabular',
    Summary: 'summary',
    Matrix: 'matrix',
    MultiBlock: 'joined',
  }
  return map[format] ?? 'unknown'
}

function mapSalesforceType(sfType: string, isFormula: boolean): import('@context-layer/shared').FieldType {
  if (isFormula) return 'formula'
  const map: Record<string, import('@context-layer/shared').FieldType> = {
    currency: 'currency',
    double: 'number',
    int: 'number',
    percent: 'number',
    boolean: 'boolean',
    date: 'date',
    datetime: 'datetime',
    string: 'text',
    textarea: 'text',
    email: 'text',
    phone: 'text',
    url: 'text',
    id: 'text',
    reference: 'lookup',
    picklist: 'picklist',
    multipicklist: 'multipicklist',
    summary: 'rollup',
  }
  return map[sfType] ?? 'unknown'
}
