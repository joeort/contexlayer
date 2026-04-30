import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react'
import type { Report } from '@context-layer/shared'
import { ReviewActions } from './ReviewActions'

async function getReport(id: string, token: string): Promise<Report | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/reports/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

function confidenceColor(confidence: number) {
  if (confidence >= 0.9) return 'text-green-700 bg-green-50 border-green-200'
  if (confidence >= 0.7) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return 'High confidence — auto-draft eligible'
  if (confidence >= 0.7) return 'Medium confidence — review recommended'
  return 'Low confidence — manual review required'
}

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return null

  const report = await getReport(params.id, token)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

  if (!report) {
    return (
      <div className="max-w-2xl">
        <Link href="/dashboard/reports" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Link>
        <p className="text-gray-500">Report not found.</p>
      </div>
    )
  }

  const result = report.analysisResult
  const canAccept = report.analysisStatus === 'complete' && !!result

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/reports" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{report.name}</h1>
            {report.description && <p className="text-sm text-gray-500 mt-1">{report.description}</p>}
          </div>
          {report.url && (
            <a
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View in Salesforce
            </a>
          )}
        </div>
      </div>

      {/* Analysis status */}
      {report.analysisStatus === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            This report is queued for analysis. Come back in a few minutes or click Re-analyze to trigger it now.
          </p>
        </div>
      )}

      {report.analysisStatus === 'analyzing' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">Analysis in progress…</p>
        </div>
      )}

      {/* Analysis result */}
      {result && (
        <>
          {/* Confidence banner */}
          <div className={`border rounded-xl p-4 mb-6 flex items-start gap-3 ${confidenceColor(result.confidence)}`}>
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">
                {Math.round(result.confidence * 100)}% confidence — {confidenceLabel(result.confidence)}
              </p>
              {result.notes && <p className="text-sm mt-1 opacity-90">{result.notes}</p>}
            </div>
          </div>

          {/* Extracted metric definition */}
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 mb-6">
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-500">Metric name</span>
              <span className="text-sm font-semibold text-gray-900">{result.metricName}</span>
            </div>
            {result.metricAliases.length > 0 && (
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500">Also known as</span>
                <span className="text-sm text-gray-700">{result.metricAliases.join(', ')}</span>
              </div>
            )}
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-500">Category</span>
              <span className="text-sm text-gray-700 capitalize">{result.category.replace('_', ' ')}</span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-500">Primary field</span>
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{result.primaryField}</code>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-sm text-gray-500">Aggregation</span>
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{result.aggregation}</code>
            </div>
          </div>

          {/* Filters */}
          {result.filters.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters</h3>
              <div className="space-y-2">
                {result.filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{f.field}</code>
                    <span className="text-gray-400">{f.op}</span>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{String(f.value)}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exclusions */}
          {result.exclusions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Exclusions</h3>
              <ul className="space-y-1">
                {result.exclusions.map((e, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <ReviewActions reportId={report.id} canAccept={canAccept} apiUrl={apiUrl} />
    </div>
  )
}
