'use client'

import { useState } from 'react'
import { Plus, Trash2, Copy, Check, Key, Eye, EyeOff } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
  isActive: boolean
}

interface Props {
  apiUrl: string
  initialKeys: ApiKey[]
}

export function ApiKeyManager({ apiUrl, initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const created = await res.json()
      setNewKey(created.plainKey)
      setKeys((prev) => [{ ...created, plainKey: undefined }, ...prev])
      setNewName('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    setRevoking(id)
    try {
      await fetch(`${apiUrl}/api/v1/api-keys/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setKeys((prev) => prev.filter((k) => k.id !== id))
    } finally {
      setRevoking(null)
    }
  }

  function copyKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      {/* New key reveal */}
      {newKey && (
        <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl">
          <p className="text-sm font-semibold text-teal-800 mb-2">
            Copy your API key now — it won't be shown again.
          </p>
          <div className="flex items-center gap-2 bg-white border border-teal-200 rounded-lg p-3">
            <code className="flex-1 text-sm font-mono text-gray-800 break-all">{newKey}</code>
            <button
              onClick={copyKey}
              className="shrink-0 p-1.5 rounded hover:bg-teal-100 transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-teal-600" />
              ) : (
                <Copy className="h-4 w-4 text-teal-600" />
              )}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-teal-600 hover:underline"
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Create key form */}
      {showForm ? (
        <form onSubmit={createKey} className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
          <label className="block text-sm font-medium text-gray-700 mb-1">Key name</label>
          <p className="text-xs text-gray-500 mb-3">
            A label to identify this key, e.g. "Claude Desktop" or "Cursor IDE".
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Claude Desktop"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewName('') }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New API Key
        </button>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4"
            >
              <div className="p-2 bg-gray-50 rounded-lg">
                <Key className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{key.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{key.keyPrefix}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Created {formatDate(key.createdAt)}</p>
                <p className="text-xs text-gray-400">
                  Last used: {formatDate(key.lastUsedAt)}
                </p>
              </div>
              <button
                onClick={() => revokeKey(key.id)}
                disabled={revoking === key.id}
                className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Revoke key"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
