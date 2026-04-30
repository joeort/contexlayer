import { CONNECTOR_DISPLAY_NAMES } from '@context-layer/shared'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const CONNECTOR_ICONS: Partial<Record<string, string>> = {
  salesforce: '☁️',
  hubspot: '🟠',
  gong: '🎯',
  snowflake: '❄️',
  bigquery: '📊',
  looker: '👁️',
  tableau: '📈',
  stripe: '💳',
}

const AVAILABLE: string[] = ['salesforce', 'hubspot', 'snowflake', 'gong']
const COMING_SOON: string[] = ['bigquery', 'looker', 'tableau', 'redshift', 'stripe', 'zuora', 'marketo', 'gainsight', 'clari']

export default function NewConnectorPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/connectors"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Connectors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Connector</h1>
        <p className="text-gray-500 mt-1">
          Choose a system to connect. Context Layer will auto-discover its schema and reports.
        </p>
      </div>

      <div className="space-y-6">
        {/* Available now */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Available Now
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AVAILABLE.map((type) => (
              <Link
                key={type}
                href={`/dashboard/connectors/new/${type}`}
                className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 hover:border-teal-DEFAULT hover:shadow-sm transition-all group"
              >
                <span className="text-2xl">{CONNECTOR_ICONS[type] ?? '🔌'}</span>
                <span className="font-medium text-gray-900 group-hover:text-teal-DEFAULT transition-colors">
                  {CONNECTOR_DISPLAY_NAMES[type as keyof typeof CONNECTOR_DISPLAY_NAMES]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Coming soon */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Coming Soon
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {COMING_SOON.map((type) => (
              <div
                key={type}
                className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center gap-4 opacity-60 cursor-not-allowed"
              >
                <span className="text-2xl">{CONNECTOR_ICONS[type] ?? '🔌'}</span>
                <div>
                  <p className="font-medium text-gray-700">
                    {CONNECTOR_DISPLAY_NAMES[type as keyof typeof CONNECTOR_DISPLAY_NAMES]}
                  </p>
                  <p className="text-xs text-gray-400">Coming soon</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
