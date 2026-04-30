import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { FileText, CheckCircle, Clock, AlertCircle, Search, RefreshCw } from 'lucide-react'
import type { Report, AnalysisStatus } from '@context-layer/shared'

const STATUS_CONFIG: Record<AnalysisStatus, { icon: React.ReactNode; label: string; pill: string }> = {
  pending: {
    icon: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
    label: 'Pending',
    pill: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  analyzing: {
    icon: <Search className="h-3.5 w-3.5 text-blue-500 animate-pulse" />,
    label: 'Analyzing…',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  complete: {
    icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    label: 'Ready to review',
    pill: 'bg-green-50 text-green-700 border-green-200',
  },
  failed: {
    icon: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
    label: 'Failed',
    pill: 'bg-red-50 text-red-700 border-red-200',
  },
}

function confidenceBadge(confidence: number) {
  const pct = Math.round(confidence * 100)
  const color =
    confidence >= 0.9 ? 'text-green-700 bg-green-50' :
    confidence >= 0.7 ? 'text-yellow-700 bg-yellow-50' :
    'text-red-700 bg-red-50'
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${color}`}>{pct}%</span>
}

async function getReports(token: string | null, status?: string): Promise<Report[]> {
  if (!token) return []
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const url = status
    ? `${apiUrl}/api/v1/reports?status=${status}`
    : `${apiUrl}/api/v1/reports`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? res.json() : []
  } catch {
    return []
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const { getToken } = await auth()
  const token = await getToken()
  const activeFilter = searchParams.status

  const reports = await getReports(token, activeFilter)

  const tabs: Array<{ label: string; value?: string; count?: number }> = [
    { label: 'All', value: undefined },
    { label: 'Ready to review', value: 'complete' },
    { label: 'Pending', value: 'pending' },
    { label: 'Analyzing', value: 'analyzing' },
    { label: 'Failed', value: 'failed' },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">
            Reports discovered from your connected systems. Context Layer analyzes these to auto-generate metric definitions.
          </p>
        </div>
        {reports.length > 0 && (
          <div className="text-sm text-gray-500 mt-1">
            {reports.length} report{reports.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(({ label, value }) => {
          const isActive = activeFilter === value
          const href = value ? `/dashboard/reports?status=${value}` : '/dashboard/reports'
          return (
            <Link
              key={label}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-teal-DEFAULT text-teal-DEFAULT'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-700 mb-1">No reports found</h3>
          <p className="text-sm text-gray-500">
            {activeFilter
              ? `No reports with status "${activeFilter}". Try a different filter.`
              : 'Connect a system and run a sync. Reports will appear here once discovered.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Report
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                  Confidence
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                  Metric
                </th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map((report) => {
                const cfg = STATUS_CONFIG[report.analysisStatus]
                return (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-sm">{report.name}</p>
                      {report.description && (
                        <p className="text-xs text-gray-400 truncate max-w-sm mt-0.5">{report.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.pill}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {report.analysisResult
                        ? confidenceBadge(report.analysisResult.confidence)
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 truncate max-w-xs">
                      {report.analysisResult?.metricName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/reports/${report.id}`}
                        className="text-xs font-medium text-teal-DEFAULT hover:underline"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
