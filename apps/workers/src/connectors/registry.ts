import type { FieldRepo, ReportRepo } from '@context-layer/database'

export interface ConnectorCrawlContext {
  orgId: string
  connectorId: string
  credentials: Record<string, unknown>
  fieldRepo: FieldRepo
  reportRepo: ReportRepo
}

export interface IConnector {
  crawlSchema(ctx: ConnectorCrawlContext): Promise<void>
  fetchReports?(ctx: ConnectorCrawlContext): Promise<void>
}

// Registry: connector type string → implementation
const registry = new Map<string, IConnector>()

export const ConnectorRegistry = {
  register(type: string, connector: IConnector) {
    registry.set(type, connector)
  },
  get(type: string): IConnector | undefined {
    return registry.get(type)
  },
}

// Lazy-load connector implementations
// Each connector registers itself when imported
// In worker.ts we import the connectors we support

export async function loadConnectors() {
  const { SalesforceConnector } = await import('./salesforce.js')
  ConnectorRegistry.register('salesforce', new SalesforceConnector())

  const { HubSpotConnector } = await import('./hubspot.js')
  ConnectorRegistry.register('hubspot', new HubSpotConnector())

  const { SnowflakeConnector } = await import('./snowflake.js')
  ConnectorRegistry.register('snowflake', new SnowflakeConnector())

  const { GongConnector } = await import('./gong.js')
  ConnectorRegistry.register('gong', new GongConnector())
}
