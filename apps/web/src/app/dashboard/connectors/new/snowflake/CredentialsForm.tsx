'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface SnowflakeCredentials {
  account: string
  username: string
  password: string
  warehouse: string
  database: string
  schema: string
  displayName: string
}

export function SnowflakeCredentialsForm({ apiUrl }: { apiUrl: string }) {
  const { getToken } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<SnowflakeCredentials>({
    account: '',
    username: '',
    password: '',
    warehouse: '',
    database: '',
    schema: 'PUBLIC',
    displayName: 'Snowflake',
  })

  function handleChange(key: keyof SnowflakeCredentials, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${apiUrl}/api/v1/connectors/snowflake/connect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      router.push(`/dashboard/connectors/${data.connectorId}?setup=complete`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      setLoading(false)
    }
  }

  const fields: Array<{ key: keyof SnowflakeCredentials; label: string; placeholder: string; type?: string }> = [
    { key: 'account', label: 'Account Identifier', placeholder: 'xy12345.us-east-1' },
    { key: 'username', label: 'Username', placeholder: 'CONTEXT_LAYER_USER' },
    { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    { key: 'warehouse', label: 'Warehouse', placeholder: 'COMPUTE_WH' },
    { key: 'database', label: 'Database', placeholder: 'PRODUCTION' },
    { key: 'schema', label: 'Default Schema', placeholder: 'PUBLIC' },
    { key: 'displayName', label: 'Display Name', placeholder: 'Snowflake Production' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(({ key, label, placeholder, type }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <input
            type={type ?? 'text'}
            value={form[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={placeholder}
            required={key !== 'schema' && key !== 'displayName'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-DEFAULT focus:border-transparent"
          />
        </div>
      ))}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#29B5E8] text-white rounded-lg font-medium hover:bg-[#1a9fd0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? 'Connecting…' : 'Connect Snowflake'}
      </button>
    </form>
  )
}
