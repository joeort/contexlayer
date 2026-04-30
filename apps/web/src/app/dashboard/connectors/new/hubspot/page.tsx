import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { HubSpotConnectButton } from './ConnectButton'

export default function NewHubSpotPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.contextlayer.io'

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link
          href="/dashboard/connectors/new"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🟠</span>
          <h1 className="text-2xl font-bold text-gray-900">Connect HubSpot</h1>
        </div>
        <p className="text-gray-500">
          Context Layer will read your CRM properties to build a field dictionary for contacts, deals, and companies.
        </p>
      </div>

      {searchParams.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">What we&apos;ll access</h2>
        <ul className="space-y-2">
          {[
            'Contact, deal, company, and ticket properties',
            'Deal pipeline stages',
            'Custom property labels and field types',
            'Owner assignments (read-only)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-teal-DEFAULT mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-400">
          Read-only access. No data is modified in your HubSpot account.
        </p>
      </div>

      <HubSpotConnectButton apiUrl={apiUrl} />
    </div>
  )
}
