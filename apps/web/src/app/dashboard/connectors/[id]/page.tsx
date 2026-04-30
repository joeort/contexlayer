import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Clock, AlertCircle, RefreshCw, Database } from 'lucide-react'
import type { ConnectorStatus } from '@context-layer/shared'

const STATUS_CONFIG: Record<ConnectorStatus, { icon: React.ReactNode; label: string; color: string }> = {
  active: {
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    label: 'Active',
    color: 'text-green-700 bg-green-50 border-green-200',
  },
  pending: {
    icon: <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />,
    label: 'Syncing…',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
    label: 'Error',
    color: 'text-red-700 bg-red-50 border-red-200',
  },
  paused: {
    icon: <Clock className="h-5 w-5 text-gray-400" />,
    label: 'Paused',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
  },
}

interface ConnectorDetail {
  id: string
  type: string
  displayName: string
  status: ConnectorStatus
  config: Record<string, unknown>
  lastSyncedAt: string | null
  errorMessage: string | null
  createdAt: string
}

async function getConnector(id: string, token: string): Promise<ConnectorDetail | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/connectors/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function ConnectorDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { setup?: string }
}) {
  const { getToken } = await auth()
  const token = await getToken()
  const connector = token ? await getConnector(params.id, token) : null

  const justConnected = searchParams.setup === 'complete'
  const status = connector?.status ?? 'pending'
  const statusCfg = STATUS_CONFIG[status]

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/connectors"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          All Connectors
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {connector?.displayName ?? 'Connector'}
          </h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Success banner after OAuth */}
      {justConnected && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-teal-900 text-sm">Salesforce connected successfully</p>
            <p className="text-sm text-teal-700 mt-0.5">
              Schema discovery is running in the background. This takes 5–30 minutes depending on the size of your org.
              Refresh this page to see progress.
            </p>
          </div>
        </div>
      )}

      {connector ? (
        <div className="space-y-4">
          {/* Details card */}
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            <div className="p-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">Type</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{connector.type}</span>
            </div>
            {connector.config.instanceUrl && (
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">Instance URL</span>
                <span className="text-sm font-mono text-gray-700">{String(connector.config.instanceUrl)}</span>
              </div>
            )}
            <div className="p-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">Connected</span>
              <span className="text-sm text-gray-700">{new Date(connector.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">Last synced</span>
              <span className="text-sm text-gray-700">
                {connector.lastSyncedAt
                  ? new Date(connector.lastSyncedAt).toLocaleString()
                  : 'Never (sync running…)'}
              </span>
            </div>
          </div>

          {/* Error message */}
          {connector.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Sync error</p>
                <p className="text-sm text-red-700 mt-0.5">{connector.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={`/dashboard/connectors/${connector.id}/schema`}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-teal-DEFAULT hover:text-teal-DEFAULT transition-colors"
            >
              <Database className="h-4 w-4" />
              Browse Schema
            </Link>
            <TriggerSyncButton connectorId={connector.id} />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-600 font-medium">Setting up connector…</p>
          <p className="text-sm text-gray-400 mt-1">This page will update once the connector is ready.</p>
        </div>
      )}
    </div>
  )
}

// Thin client wrapper just for the trigger-sync button (needs onClick)
function TriggerSyncButton({ connectorId }: { connectorId: string }) {
  // This is intentionally a server component placeholder.
  // The button is rendered but sync is triggered via the API route link below.
  return (
    <Link
      href={`/dashboard/connectors/${connectorId}/sync`}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-teal-DEFAULT hover:text-teal-DEFAULT transition-colors"
    >
      <RefreshCw className="h-4 w-4" />
      Re-sync
    </Link>
  )
}
