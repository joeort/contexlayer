'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, RotateCcw, Loader2 } from 'lucide-react'

export function ReviewActions({
  reportId,
  canAccept,
  apiUrl,
}: {
  reportId: string
  canAccept: boolean
  apiUrl: string
}) {
  const { getToken } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'reject' | 'reanalyze' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function callApi(path: string, method = 'POST') {
    const token = await getToken()
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message ?? `Request failed (${res.status})`)
    }
    return res.json()
  }

  async function handleAccept() {
    setLoading('accept')
    setError(null)
    try {
      await callApi(`/api/v1/reports/${reportId}/accept`)
      router.push('/dashboard/dictionary/metrics?from=report')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accept failed')
      setLoading(null)
    }
  }

  async function handleReject() {
    setLoading('reject')
    setError(null)
    try {
      await callApi(`/api/v1/reports/${reportId}/reject`)
      router.push('/dashboard/reports')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
      setLoading(null)
    }
  }

  async function handleReanalyze() {
    setLoading('reanalyze')
    setError(null)
    try {
      await callApi(`/api/v1/reports/${reportId}/analyze`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analyze failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        {canAccept && (
          <button
            onClick={handleAccept}
            disabled={loading !== null}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-DEFAULT text-white rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Accept — create metric
          </button>
        )}
        <button
          onClick={handleReanalyze}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading === 'reanalyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Re-analyze
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-red-600 rounded-lg text-sm font-medium hover:border-red-200 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Reject
        </button>
      </div>
    </div>
  )
}
