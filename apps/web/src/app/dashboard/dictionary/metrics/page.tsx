import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ArrowLeft, Plus, TrendingUp, Clock } from 'lucide-react'
import type { Metric } from '@context-layer/shared'

const CATEGORY_COLORS: Record<string, string> = {
  revenue: 'bg-green-50 text-green-700',
  pipeline: 'bg-blue-50 text-blue-700',
  activity: 'bg-purple-50 text-purple-700',
  product: 'bg-indigo-50 text-indigo-700',
  finance: 'bg-yellow-50 text-yellow-700',
  marketing: 'bg-pink-50 text-pink-700',
  customer_success: 'bg-teal-50 text-teal-700',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-50 text-green-700',
  deprecated: 'bg-red-50 text-red-600',
}

interface MetricWithVersionCount extends Metric {
  versionCount?: number
  latestVersion?: {
    versionNumber: number
    effectiveFrom: string
  }
}

async function getMetrics(token: string): Promise<MetricWithVersionCount[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? res.json() : []
  } catch {
    return []
  }
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: { from?: string }
}) {
  const { getToken } = await auth()
  const token = await getToken()
  const metrics = token ? await getMetrics(token) : []
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const fromReport = searchParams.from === 'report'

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/dictionary"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Data Dictionary
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Metrics</h1>
            <p className="text-gray-500 mt-1">
              Named business metrics with versioned definitions. Each version has an effective date so historical queries return the right definition.
            </p>
          </div>
        </div>
      </div>

      {fromReport && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-teal-600 shrink-0" />
          <p className="text-sm text-teal-800">
            Metric created from report analysis. Review its definition below and add an effective date if needed.
          </p>
        </div>
      )}

      {metrics.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <TrendingUp className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-700 mb-1">No metrics yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Metrics are auto-generated when you accept a report analysis. You can also create them manually.
          </p>
          <Link
            href="/dashboard/reports?status=complete"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-DEFAULT text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
          >
            Review analyzed reports
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map((metric) => (
            <Link
              key={metric.id}
              href={`/dashboard/dictionary/metrics/${metric.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-DEFAULT hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-900 group-hover:text-teal-DEFAULT transition-colors">
                      {metric.name}
                    </h2>
                    {metric.status && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[metric.status] ?? STATUS_COLORS.draft}`}>
                        {metric.status}
                      </span>
                    )}
                    {metric.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[metric.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {metric.category.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  {metric.aliases.length > 0 && (
                    <p className="text-xs text-gray-400">Also: {metric.aliases.join(', ')}</p>
                  )}
                  {metric.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{metric.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0 mt-0.5">
                  <Clock className="h-3.5 w-3.5" />
                  Added {new Date(metric.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
