const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error ?? error.message ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  // Connectors
  connectors: {
    list: () => apiFetch<import('@context-layer/shared').Connector[]>('/connectors'),
    get: (id: string) => apiFetch<import('@context-layer/shared').Connector>(`/connectors/${id}`),
    create: (data: unknown) =>
      apiFetch<import('@context-layer/shared').Connector>('/connectors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    sync: (id: string) =>
      apiFetch<{ message: string }>(`/connectors/${id}/sync`, { method: 'POST' }),
    getSchema: (id: string) => apiFetch(`/connectors/${id}/schema`),
    getReports: (id: string) => apiFetch(`/connectors/${id}/reports`),
  },

  // Dictionary
  fields: {
    listObjects: (connectorId?: string) =>
      apiFetch<import('@context-layer/shared').SchemaObject[]>(
        `/fields/objects${connectorId ? `?connectorId=${connectorId}` : ''}`
      ),
    listFields: (objectId: string) =>
      apiFetch<import('@context-layer/shared').SchemaField[]>(
        `/fields/objects/${objectId}/fields`
      ),
    annotate: (fieldId: string, data: unknown) =>
      apiFetch<import('@context-layer/shared').FieldAnnotation>(`/fields/${fieldId}/annotations`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  metrics: {
    list: (status?: string) =>
      apiFetch<import('@context-layer/shared').Metric[]>(`/metrics${status ? `?status=${status}` : ''}`),
    get: (id: string) => apiFetch<import('@context-layer/shared').Metric>(`/metrics/${id}`),
    create: (data: unknown) =>
      apiFetch<import('@context-layer/shared').Metric>('/metrics', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    listVersions: (id: string) =>
      apiFetch<import('@context-layer/shared').MetricVersion[]>(`/metrics/${id}/versions`),
    addVersion: (id: string, data: unknown) =>
      apiFetch<import('@context-layer/shared').MetricVersion>(`/metrics/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  reports: {
    list: (status?: string) =>
      apiFetch<import('@context-layer/shared').Report[]>(`/reports${status ? `?status=${status}` : ''}`),
    get: (id: string) => apiFetch<import('@context-layer/shared').Report>(`/reports/${id}`),
    analyze: (id: string) =>
      apiFetch<{ message: string }>(`/reports/${id}/analyze`, { method: 'POST' }),
    accept: (id: string) =>
      apiFetch<{ message: string; metricId: string }>(`/reports/${id}/accept`, { method: 'POST' }),
  },
}
