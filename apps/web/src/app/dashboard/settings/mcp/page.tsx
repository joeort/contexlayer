import { auth } from '@clerk/nextjs/server'
import { Zap, Copy, Terminal, FlaskConical } from 'lucide-react'
import { McpTestConsole } from './McpTestConsole'

export default async function McpSettingsPage() {
  const { orgId } = await auth()

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.contextlayer.io'
  const exampleApiKey = `cl_org_${orgId}_your_secret`
  const mcpEndpoint = `${apiUrl}/mcp/v1`

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        'context-layer': {
          url: mcpEndpoint,
          headers: { 'x-api-key': exampleApiKey },
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
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-2">Claude Desktop Configuration</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add this to your <code className="bg-gray-100 px-1 rounded">claude_desktop_config.json</code>:
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
            {claudeConfig}
          </pre>
          <button className="absolute top-3 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Replace <code>your_secret</code> with your actual API key. Keys are issued under API Keys in Settings.
        </p>
      </div>
    </div>
  )
}
