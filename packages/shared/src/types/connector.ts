export type ConnectorType =
  | 'salesforce'
  | 'hubspot'
  | 'gong'
  | 'snowflake'
  | 'bigquery'
  | 'redshift'
  | 'looker'
  | 'tableau'
  | 'stripe'
  | 'zuora'
  | 'marketo'
  | 'gainsight'
  | 'clari'

export type ConnectorStatus = 'pending' | 'active' | 'error' | 'paused'

export interface Connector {
  id: string
  orgId: string
  type: ConnectorType
  displayName: string
  status: ConnectorStatus
  config: Record<string, unknown>
  lastSyncedAt: Date | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

export type ObjectType = 'standard' | 'custom' | 'view' | 'report_folder'

export interface SchemaObject {
  id: string
  orgId: string
  connectorId: string
  objectName: string
  objectLabel: string | null
  objectType: ObjectType
  recordCount: number | null
  metadata: Record<string, unknown>
  discoveredAt: Date
}

export type FieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'picklist'
  | 'multipicklist'
  | 'lookup'
  | 'formula'
  | 'rollup'
  | 'unknown'

export interface SchemaField {
  id: string
  orgId: string
  connectorId: string
  objectId: string
  fieldName: string
  fieldLabel: string | null
  fieldType: FieldType
  isCustom: boolean
  formula: string | null
  metadata: Record<string, unknown>
  sampleValues: unknown[] | null
  nullRate: number | null
  discoveredAt: Date
}

export interface FieldAnnotation {
  id: string
  orgId: string
  fieldId: string
  description: string | null
  usageNotes: string | null
  isPreferred: boolean
  replacesFieldId: string | null
  authoredBy: string
  confidence: number | null
  createdAt: Date
  updatedAt: Date
}

export const CONNECTOR_DISPLAY_NAMES: Record<ConnectorType, string> = {
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  gong: 'Gong',
  snowflake: 'Snowflake',
  bigquery: 'BigQuery',
  redshift: 'Amazon Redshift',
  looker: 'Looker',
  tableau: 'Tableau',
  stripe: 'Stripe',
  zuora: 'Zuora',
  marketo: 'Marketo',
  gainsight: 'Gainsight',
  clari: 'Clari',
}
