import Link from 'next/link'
import { Zap, Key } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">API keys, MCP configuration, and team management</p>
      </div>

      <div className="space-y-4">
        <Link
          href="/dashboard/settings/mcp"
          className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-DEFAULT hover:shadow-sm transition-all group"
        >
          <div className="p-3 bg-teal-50 rounded-lg">
            <Zap className="h-6 w-6 text-teal-DEFAULT" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-teal-DEFAULT transition-colors">
              MCP Server
            </h2>
            <p className="text-sm text-gray-500">
              Your MCP endpoint URL and API keys. Connect Claude Desktop, Cursor, or any MCP-compatible AI tool.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/settings/api-keys"
          className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-DEFAULT hover:shadow-sm transition-all group"
        >
          <div className="p-3 bg-gray-50 rounded-lg">
            <Key className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-teal-DEFAULT transition-colors">
              API Keys
            </h2>
            <p className="text-sm text-gray-500">
              Create and manage API keys that authenticate MCP clients to your org's context.
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
