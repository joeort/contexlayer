export type BusinessRuleType =
  | 'filter'
  | 'join'
  | 'exclusion'
  | 'alias'
  | 'nuance'
  | 'temporal_change'

export interface BusinessRule {
  id: string
  orgId: string
  ruleType: BusinessRuleType
  title: string
  description: string
  appliesTo: {
    metrics?: string[]
    objects?: string[]
    connectors?: string[]
  }
  structuredRule: Record<string, unknown> | null
  effectiveFrom: Date | null
  effectiveTo: Date | null
  priority: number
  isActive: boolean
  source: string
  createdAt: Date
  updatedAt: Date
}

export type ReportType = 'tabular' | 'summary' | 'matrix' | 'joined' | 'dashboard' | 'unknown'
export type AnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'failed'

export interface Report {
  id: string
  orgId: string
  connectorId: string
  externalId: string
  name: string
  description: string | null
  reportType: ReportType
  url: string | null
  rawDefinition: Record<string, unknown>
  analysisStatus: AnalysisStatus
  analysisResult: ReportAnalysisResult | null
  analyzedAt: Date | null
  createdAt: Date
}

export interface ReportAnalysisResult {
  metricName: string
  metricAliases: string[]
  category: string
  primaryField: string
  aggregation: string
  filters: Array<{ field: string; op: string; value: unknown }>
  exclusions: string[]
  notes: string
  confidence: number
}

export interface JoinPath {
  id: string
  orgId: string
  name: string | null
  steps: Array<{
    fromConnector: string
    fromObject: string
    fromField: string
    toConnector: string
    toObject: string
    toField: string
    joinType: 'inner' | 'left'
  }>
  discoveredFrom: string | null
  confidence: number
  isVerified: boolean
  createdAt: Date
}

// MCP types
export type McpIntentCategory =
  | 'metric_lookup'
  | 'field_resolution'
  | 'query_generation'
  | 'definition_lookup'
  | 'unknown'

export interface ContextBundle {
  metric?: {
    name: string
    version: number
    effectiveFrom: string
    notes: string | null
    changedRecently: boolean
  }
  primaryField?: {
    fieldName: string
    fieldLabel: string | null
    object: string
    connector: string
    usageNote: string | null
    alternatives?: Array<{ fieldName: string; context: string }>
  }
  sql?: string
  rulesApplied: string[]
  warnings: string[]
  contextNotes: string | null
}

export interface McpRequest {
  id: string
  orgId: string
  apiKeyId: string | null
  intent: string
  intentCategory: McpIntentCategory
  contextServed: ContextBundle | null
  metricsMatched: string[]
  fieldsMatched: string[]
  rulesApplied: string[]
  latencyMs: number | null
  createdAt: Date
}
