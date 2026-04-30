import { auth } from '@clerk/nextjs/server'
import { Activity, Plug, BookOpen, FileText, Zap } from 'lucide-react'

export default async function DashboardPage() {
  const { orgSlug } = await auth()

  const stats = [
    { label: 'Connected Systems', value: '—', icon: Plug, color: 'text-teal-DEFAULT' },
    { label: 'Metrics Defined', value: '—', icon: BookOpen, color: 'text-navy-500' },
    { label: 'Reports Analyzed', value: '—', icon: FileText, color: 'text-orange-DEFAULT' },
    { label: 'MCP Requests Today', value: '—', icon: Activity, color: 'text-teal-DEFAULT' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 mt-1">
          Context Layer implementation dashboard for{' '}
          <span className="font-medium text-gray-700">{orgSlug ?? 'your organization'}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4"
          >
            <div className="p-2 bg-gray-50 rounded-lg">
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Getting started */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-5 w-5 text-teal-DEFAULT" />
          <h2 className="font-semibold text-gray-900">Getting Started</h2>
        </div>
        <ol className="space-y-3 text-sm text-gray-600">
          {[
            { step: 1, text: 'Connect your Salesforce org via the Connectors page' },
            { step: 2, text: 'Wait for schema crawl to complete (~20 min for large orgs)' },
            { step: 3, text: 'Review report analysis results in the Reports page' },
            { step: 4, text: 'Accept findings to populate your Data Dictionary with metric definitions' },
            { step: 5, text: 'Mark canonical fields (e.g., which ARR field to use) in the Dictionary' },
            { step: 6, text: 'Copy your MCP endpoint from Settings and connect it to Claude Desktop' },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-DEFAULT text-white text-xs flex items-center justify-center font-bold">
                {step}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
