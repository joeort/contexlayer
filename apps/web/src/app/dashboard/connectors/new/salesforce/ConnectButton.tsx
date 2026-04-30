'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { CloudLightning, Loader2 } from 'lucide-react'

export function ConnectSalesforceButton({ apiUrl }: { apiUrl: string }) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${apiUrl}/api/v1/connectors/salesforce/authorize`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to initiate connection')
      const { authUrl } = (await res.json()) as { authUrl: string }
      window.location.href = authUrl
    } catch (err) {
      setError('Could not connect. Make sure the API is running and try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 bg-teal-DEFAULT text-white rounded-lg font-medium hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <CloudLightning className="h-5 w-5" />
        )}
        {loading ? 'Redirecting to Salesforce…' : 'Connect to Salesforce'}
      </button>
      <p className="text-xs text-gray-400 mt-2">
        You'll be redirected to Salesforce to authorize. You must be a Salesforce admin.
      </p>
    </div>
  )
}
