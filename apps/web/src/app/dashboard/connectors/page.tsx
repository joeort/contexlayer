import Link from 'next/link'
import { Plus, Plug, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { ConnectorStatus } from '@context-layer/shared'

const STATUS_ICONS: Record<ConnectorStatus, React.ReactNode> = {
  active: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  paused: <Clock className="h-4 w-4 text-gray-400" />,
}

const STATUS_LABELS: Record<ConnectorStatus, string> = {
  active: 'Active',
  error: 'Error',
  pending: 'Connecting',
  paused: 'Paused',
}

export default function ConnectorsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
          <p className="text-gray-500 mt-1">
            Connect your GTM systems so Context Layer can discover their schema
          </p>
        </div>
        <Link
          href="/dashboard/connectors/new"
          className="flex items-center gap-2 px-4 py-2 bg-teal-DEFAULT text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Connector
        </Link>
      </div>

      {/* Empty state — populated via client component after API call */}
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <Plug className="h-10 w-10 text-gray-300 mx-auto mb-4" />
        <h3 className="font-medium text-gray-700 mb-1">No connectors yet</h3>
        <p className="text-sm text-gray-500 mb-4">
          Start by connecting your Salesforce org
        </p>
        <Link
          href="/dashboard/connectors/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-DEFAULT text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add your first connector
        </Link>
      </div>
    </div>
  )
}
