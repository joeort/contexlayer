import { auth } from '@clerk/nextjs/server'
import { Key } from 'lucide-react'
import { ApiKeyManager } from './ApiKeyManager'

async function fetchApiKeys(apiUrl: string) {
  try {
    // Server-side fetch uses the Clerk session cookie forwarded from the browser.
    // In production this will use the user's session; for now we return empty on error.
    const res = await fetch(`${apiUrl}/api/v1/api-keys`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function ApiKeysPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const keys = await fetchApiKeys(apiUrl)

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Key className="h-5 w-5 text-gray-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        </div>
        <p className="text-gray-500 ml-12">
          Keys authenticate MCP clients (Claude Desktop, Cursor, etc.) to your Context Layer instance.
          Each key is shown exactly once — store it securely.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">How to use</h2>
        <p className="text-sm text-gray-500 mb-3">
          Add the key to your MCP client config as the <code className="bg-gray-100 px-1 rounded">x-api-key</code> header.
        </p>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "context-layer": {
      "url": "${apiUrl}/mcp/v1",
      "headers": { "x-api-key": "cl_live_..." }
    }
  }
}`}
        </pre>
      </div>

      <ApiKeyManager apiUrl={apiUrl} initialKeys={keys} />
    </div>
  )
}
