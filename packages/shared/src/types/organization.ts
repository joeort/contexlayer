export type OrgPlan = 'trial' | 'starter' | 'growth' | 'enterprise'

export interface Organization {
  id: string
  slug: string
  name: string
  plan: OrgPlan
  settings: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}
