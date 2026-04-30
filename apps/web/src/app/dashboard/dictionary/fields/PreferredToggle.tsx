'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { Star, Loader2 } from 'lucide-react'

export function PreferredToggle({
  fieldId,
  isPreferred,
  apiUrl,
}: {
  fieldId: string
  isPreferred: boolean
  apiUrl: string
}) {
  const { getToken } = useAuth()
  const [preferred, setPreferred] = useState(isPreferred)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${apiUrl}/api/v1/fields/${fieldId}/annotations`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPreferred: !preferred }),
      })
      if (res.ok) setPreferred((p) => !p)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={preferred ? 'Remove as preferred field' : 'Mark as preferred field'}
      className={`p-1 rounded transition-colors ${
        preferred
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-gray-300 hover:text-amber-400'
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className="h-4 w-4" fill={preferred ? 'currentColor' : 'none'} />
      )}
    </button>
  )
}
