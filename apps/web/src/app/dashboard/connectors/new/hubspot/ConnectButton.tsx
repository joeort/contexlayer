'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export function HubSpotConnectButton({ apiUrl }: { apiUrl: string }) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${apiUrl}/api/v1/connectors/hubspot/authorize`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const { authUrl } = await res.json()
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start authorization')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#FF7A59] text-white rounded-lg font-medium hover:bg-[#e8603f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.164 7.93A5.282 5.282 0 0 0 15.5 2.5a5.28 5.28 0 0 0-5.28 5.28c0 .612.105 1.2.297 1.747L7.45 11.79a5.277 5.277 0 0 0-2.95-.9 5.28 5.28 0 1 0 5.28 5.28c0-.612-.105-1.2-.297-1.748l3.067-2.263a5.277 5.277 0 0 0 2.95.9 5.28 5.28 0 0 0 2.664-9.128Z" />
          </svg>
        )}
        {loading ? 'Connecting…' : 'Connect HubSpot'}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
