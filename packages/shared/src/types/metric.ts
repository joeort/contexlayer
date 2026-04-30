export type MetricCategory =
  | 'revenue'
  | 'pipeline'
  | 'activity'
  | 'product'
  | 'finance'
  | 'marketing'
  | 'customer_success'

export type MetricStatus = 'draft' | 'active' | 'deprecated'

export interface Metric {
  id: string
  orgId: string
  name: string
  aliases: string[]
  description: string | null
  category: MetricCategory | null
  status: MetricStatus
  createdAt: Date
  updatedAt: Date
}

export type MetricVersionSource = 'manual' | 'report_analysis' | 'llm_inference'

export interface MetricFilter {
  field: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'like' | 'between' | 'is_null' | 'is_not_null'
  value: unknown
}

export interface MetricJoin {
  fromObject: string
  fromField: string
  toObject: string
  toField: string
  joinType: 'inner' | 'left'
}

export interface MetricDefinition {
  primaryField: {
    connector: string
    object: string
    field: string
  }
  aggregation: 'SUM' | 'COUNT' | 'COUNT_DISTINCT' | 'AVG' | 'MIN' | 'MAX'
  filters: MetricFilter[]
  joins: MetricJoin[]
  exclusions: string[]
  segmentBy: string[]
}

export interface MetricVersion {
  id: string
  metricId: string
  orgId: string
  versionNumber: number
  effectiveFrom: Date
  effectiveTo: Date | null
  definition: MetricDefinition
  sqlTemplate: string | null
  notes: string | null
  source: MetricVersionSource
  sourceRef: string | null
  authoredBy: string
  createdAt: Date
}
