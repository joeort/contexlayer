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

        <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-6 opacity-60 cursor-not-allowed">
          <div className="p-3 bg-gray-50 rounded-lg">
            <Key className="h-6 w-6 text-gray-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-700">API Keys</h2>
            <p className="text-sm text-gray-400">Manage API keys for programmatic access — coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}
