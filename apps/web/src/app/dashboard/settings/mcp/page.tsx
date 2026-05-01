import { auth } from '@clerk/nextjs/server'
import { Zap, Copy, Terminal, FlaskConical, Clock } from 'lucide-react'
import { McpTestConsole } from './McpTestConsole'
import { RequestLog } from './RequestLog'

async function fetchRecentRequests(apiUrl: string) {
  try {
    const res = await fetch(`${apiUrl}/api/v1/mcp/requests?limit=20`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function McpSettingsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.contextlayer.io'
  const mcpEndpoint = `${apiUrl}/mcp/v1`

  const [recentRequests] = await Promise.all([
    fetchRecentRequests(apiUrl),
  ])

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        'context-layer': {
          url: mcpEndpoint,
          headers: { 'x-api-key': 'cl_live_...' },
        },
      },
    },
    null,
    2
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">MCP Server</h1>
        <p className="text-gray-500 mt-1">
          Connect AI tools to Context Layer via the Model Context Protocol
        </p>
      </div>

      {/* Endpoint card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-teal-DEFAULT" />
          <h2 className="font-semibold text-gray-900">MCP Endpoint</h2>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm text-gray-700 flex items-center justify-between gap-2">
          <span>{mcpEndpoint}</span>
          <Copy className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 shrink-0" />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Authenticate with header: <code className="bg-gray-100 px-1 rounded">x-api-key: your-key</code>
        </p>
      </div>

      {/* Available tools */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Available MCP Tools</h2>
        <div className="space-y-3">
          {[
            { name: 'get_context', desc: 'General-purpose context retrieval for any GTM question' },
            { name: 'resolve_field', desc: 'Resolve a business term to your specific database field' },
            { name: 'get_metric_definition', desc: 'Get full metric definition with temporal context' },
            { name: 'generate_sql', desc: 'Generate org-specific SQL with correct fields and filters' },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Terminal className="h-4 w-4 text-teal-DEFAULT mt-0.5 shrink-0" />
              <div>
                <code className="text-sm font-semibold text-gray-800">{name}</code>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live test console */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="h-5 w-5 text-teal-DEFAULT" />
          <h2 className="font-semibold text-gray-900">Test Console</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Fire MCP tool calls directly from the browser to verify your data dictionary is working correctly.
        </p>
        <McpTestConsole apiUrl={apiUrl} />
      </div>

      {/* Claude Desktop config */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">Claude Desktop Configuration</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add this to your <code className="bg-gray-100 px-1 rounded">claude_desktop_config.json</code>.
          Get your key from <a href="/dashboard/settings/api-keys" className="text-teal-600 hover:underline">API Keys</a>.
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
            {claudeConfig}
          </pre>
          <button className="absolute top-3 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Request log */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Recent Requests</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Live log of MCP tool calls from your connected AI clients.
        </p>
        <RequestLog initialRequests={recentRequests} apiUrl={apiUrl} />
      </div>
    </div>
  )
}
