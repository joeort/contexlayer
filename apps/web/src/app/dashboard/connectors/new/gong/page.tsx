import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { GongCredentialsForm } from './CredentialsForm'

export default function NewGongPage() {
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
          <span className="text-3xl">🎯</span>
          <h1 className="text-2xl font-bold text-gray-900">Connect Gong</h1>
        </div>
        <p className="text-gray-500">
          Context Layer will map your Gong call schema and CRM field definitions so AI tools can reference call and deal data precisely.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">What we&apos;ll access</h2>
        <ul className="space-y-2 mb-4">
          {[
            'Call metadata (date, duration, direction, participants)',
            'CRM-linked deal schema and field labels',
            'Topic tracker definitions',
            'User and team structure',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-teal-DEFAULT mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
          <p className="font-medium mb-1">Where to find your API keys:</p>
          <p>In Gong, go to <strong>Settings → API → API Keys</strong> and create a new key with at least <strong>call:read</strong> and <strong>crm:read</strong> permissions.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">API Credentials</h2>
        <GongCredentialsForm apiUrl={apiUrl} />
      </div>
    </div>
  )
}
