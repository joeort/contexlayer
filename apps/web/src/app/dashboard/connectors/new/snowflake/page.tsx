import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { SnowflakeCredentialsForm } from './CredentialsForm'

export default function NewSnowflakePage() {
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
          <span className="text-3xl">❄️</span>
          <h1 className="text-2xl font-bold text-gray-900">Connect Snowflake</h1>
        </div>
        <p className="text-gray-500">
          Context Layer will crawl your database schema to build a field dictionary from your tables and views.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">What we&apos;ll access</h2>
        <ul className="space-y-2">
          {[
            'Table and view column names, types, and comments',
            'Schema structure across all schemas in your database',
            'No row-level data is read during setup',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-teal-DEFAULT mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 font-mono">
          {`GRANT USAGE ON DATABASE <db> TO ROLE <role>;`}<br />
          {`GRANT USAGE ON ALL SCHEMAS IN DATABASE <db> TO ROLE <role>;`}<br />
          {`GRANT SELECT ON ALL TABLES IN DATABASE <db> TO ROLE <role>;`}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          We recommend creating a dedicated read-only role. The <code>SELECT</code> grant is used only for metadata queries against INFORMATION_SCHEMA.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Connection Details</h2>
        <SnowflakeCredentialsForm apiUrl={apiUrl} />
      </div>
    </div>
  )
}
