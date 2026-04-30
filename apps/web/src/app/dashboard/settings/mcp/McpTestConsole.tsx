'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { Play, Loader2, ChevronDown } from 'lucide-react'

type Tool = 'get_context' | 'resolve_field' | 'get_metric_definition' | 'generate_sql'

const TOOL_DEFAULTS: Record<Tool, Record<string, string>> = {
  get_context: {
    query: 'What is our Q1 ARR?',
    period_start: '',
    period_end: '',
    target_connector: 'salesforce',
  },
  resolve_field: {
    concept: 'ARR',
    object_hint: 'Opportunity',
    connector_hint: 'salesforce',
  },
  get_metric_definition: {
    metric_name: 'ARR',
    as_of_date: '',
  },
  generate_sql: {
    intent: 'Q1 bookings by region',
    target_connector: 'salesforce',
    period_start: '',
    period_end: '',
  },
}

const TOOL_LABELS: Record<Tool, string> = {
  get_context: 'get_context — General question',
  resolve_field: 'resolve_field — Find a field',
  get_metric_definition: 'get_metric_definition — Look up a metric',
  generate_sql: 'generate_sql — Generate SQL',
}

export function McpTestConsole({ apiUrl }: { apiUrl: string }) {
  const { getToken } = useAuth()
  const [tool, setTool] = useState<Tool>('get_context')
  const [params, setParams] = useState<Record<string, string>>(TOOL_DEFAULTS['get_context'])
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleToolChange(newTool: Tool) {
    setTool(newTool)
    setParams(TOOL_DEFAULTS[newTool])
    setResult(null)
    setError(null)
  }

  function handleParamChange(key: string, value: string) {
    setParams((p) => ({ ...p, [key]: value }))
  }

  async function handleRun() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const token = await getToken()
      // Strip out empty string params before sending
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== '')
      )
      const res = await fetch(`${apiUrl}/api/v1/mcp/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool, params: cleanParams }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`)
      } else {
        setResult(JSON.stringify(data.result, null, 2))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const paramKeys = Object.keys(TOOL_DEFAULTS[tool])

  return (
    <div className="space-y-4">
      {/* Tool selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Tool
        </label>
        <div className="relative">
          <select
            value={tool}
            onChange={(e) => handleToolChange(e.target.value as Tool)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 pr-8 focus:outline-none focus:ring-2 focus:ring-teal-DEFAULT focus:border-transparent"
          >
            {(Object.entries(TOOL_LABELS) as Array<[Tool, string]>).map(([t, label]) => (
              <option key={t} value={t}>{label}</option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Params */}
      <div className="space-y-3">
        {paramKeys.map((key) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              {key.replace(/_/g, ' ')}
            </label>
            <input
              type="text"
              value={params[key] ?? ''}
              onChange={(e) => handleParamChange(key, e.target.value)}
              placeholder={key === 'period_start' || key === 'period_end' ? 'YYYY-MM-DD (optional)' : key === 'as_of_date' ? 'YYYY-MM-DD (leave blank for today)' : ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-DEFAULT focus:border-transparent"
            />
          </div>
        ))}
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-teal-DEFAULT text-white rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {loading ? 'Running…' : 'Run tool'}
      </button>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-mono">
          Error: {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Response
          </label>
          <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-xs overflow-x-auto max-h-80 overflow-y-auto">
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}
