import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ArrowLeft, Clock, GitBranch } from 'lucide-react'
import type { Metric, MetricVersion } from '@context-layer/shared'

async function apiGet<T>(path: string, token: string): Promise<T | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function VersionCard({ version, isCurrent }: { version: MetricVersion; isCurrent: boolean }) {
  const def = version.definition as {
    primaryField?: { connector: string; object: string; field: string }
    aggregation?: string
    filters?: Array<{ field: string; op: string; value: unknown }>
    exclusions?: string[]
  }

  return (
    <div className={`bg-white border rounded-xl p-4 ${isCurrent ? 'border-teal-DEFAULT' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isCurrent ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-600'
          }`}>
            v{version.versionNumber} {isCurrent ? '· current' : '· superseded'}
          </span>
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDate(version.effectiveFrom)}
          {version.effectiveTo && (
            <> → {formatDate(version.effectiveTo)}</>
          )}
          {!version.effectiveTo && ' → present'}
        </div>
      </div>

      {def.primaryField && (
        <div className="text-sm mb-2">
          <span className="text-gray-500">Primary field: </span>
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 text-xs">
            {def.primaryField.object}.{def.primaryField.field}
          </code>
          <span className="text-gray-400 text-xs ml-1">via {def.primaryField.connector}</span>
        </div>
      )}

      {def.aggregation && (
        <div className="text-sm mb-2">
          <span className="text-gray-500">Aggregation: </span>
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 text-xs">{def.aggregation}</code>
        </div>
      )}

      {def.filters && def.filters.length > 0 && (
        <div className="text-sm mb-2">
          <span className="text-gray-500 block mb-1">Filters:</span>
          <div className="space-y-1 pl-3">
            {def.filters.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{f.field}</code>
                <span className="text-gray-400">{f.op}</span>
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{String(f.value)}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {def.exclusions && def.exclusions.length > 0 && (
        <div className="text-sm">
          <span className="text-gray-500 block mb-1">Exclusions:</span>
          <ul className="pl-3 space-y-0.5">
            {def.exclusions.map((e, i) => (
              <li key={i} className="text-xs text-gray-600">· {e}</li>
            ))}
          </ul>
        </div>
      )}

      {version.notes && (
        <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-3">{version.notes}</p>
      )}
    </div>
  )
}

export default async function MetricDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return null

  const [metric, versions] = await Promise.all([
    apiGet<Metric>(`/api/v1/metrics/${params.id}`, token),
    apiGet<MetricVersion[]>(`/api/v1/metrics/${params.id}/versions`, token),
  ])

  if (!metric) {
    return (
      <div className="max-w-2xl">
        <Link href="/dashboard/dictionary/metrics" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Metrics
        </Link>
        <p className="text-gray-500">Metric not found.</p>
      </div>
    )
  }

  const sortedVersions = (versions ?? []).sort((a, b) => b.versionNumber - a.versionNumber)
  const currentVersion = sortedVersions.find((v) => !v.effectiveTo) ?? sortedVersions[0]

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/dictionary/metrics" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Metrics
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{metric.name}</h1>
            {metric.aliases.length > 0 && (
              <p className="text-sm text-gray-400 mt-0.5">Also known as: {metric.aliases.join(', ')}</p>
            )}
            {metric.description && (
              <p className="text-sm text-gray-600 mt-2">{metric.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Version timeline */}
      <div className="mb-4 flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">
          Definition History ({sortedVersions.length} version{sortedVersions.length !== 1 ? 's' : ''})
        </h2>
      </div>

      {sortedVersions.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400">No versions yet. This metric was created but has no definition.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedVersions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              isCurrent={version.id === currentVersion?.id}
            />
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
        When AI tools query this metric with an as-of date, Context Layer automatically returns the version that was active on that date.
        Period-spanning queries receive a UNION query with each version's definition applied to the correct date range.
      </div>
    </div>
  )
}
