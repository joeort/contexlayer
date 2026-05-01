'use client'

import { useState } from 'react'
import { Clock, Tag, Database, Shield, Code2, RefreshCw } from 'lucide-react'

interface McpRequest {
  id: string
  intent: string
  intentCategory: string | null
  metricsMatched: string[]
  fieldsMatched: string[]
  rulesApplied: string[]
  latencyMs: number | null
  sqlGenerated: boolean
  createdAt: string
}

interface Props {
  initialRequests: McpRequest[]
  apiUrl: string
}

export function RequestLog({ initialRequests, apiUrl }: Props) {
  const [requests, setRequests] = useState<McpRequest[]>(initialRequests)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/v1/mcp/requests`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) setRequests(await res.json())
    } finally {
      setLoading(false)
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No MCP requests yet</p>
        <p className="text-xs mt-1">Connect Claude Desktop and ask a question to see activity here.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{requests.length} recent requests</p>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === req.id ? null : req.id)}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-teal-400 mt-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium truncate">{req.intent}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {req.metricsMatched.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      <Tag className="h-3 w-3" />
                      {req.metricsMatched.join(', ')}
                    </span>
                  )}
                  {req.fieldsMatched.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <Database className="h-3 w-3" />
                      {req.fieldsMatched.join(', ')}
                    </span>
                  )}
                  {req.sqlGenerated && (
                    <span className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      <Code2 className="h-3 w-3" />
                      SQL
                    </span>
                  )}
                  {req.rulesApplied.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                      <Shield className="h-3 w-3" />
                      {req.rulesApplied.length} rule{req.rulesApplied.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-gray-400">{formatDate(req.createdAt)}</p>
                <p className="text-xs text-gray-400">{formatTime(req.createdAt)}</p>
                {req.latencyMs != null && (
                  <p className="text-xs text-gray-300">{req.latencyMs}ms</p>
                )}
              </div>
            </button>

            {expanded === req.id && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                {req.rulesApplied.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">Rules applied</p>
                    <ul className="space-y-0.5">
                      {req.rulesApplied.map((r) => (
                        <li key={r} className="text-xs text-gray-700 flex items-center gap-1.5">
                          <Shield className="h-3 w-3 text-orange-400 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-gray-400">ID: {req.id}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
