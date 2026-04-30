import Link from 'next/link'
import { ArrowLeft, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react'
import { ConnectSalesforceButton } from './ConnectButton'

const STEPS = [
  {
    title: 'Open Salesforce Setup',
    detail: 'Log into Salesforce as an Administrator. Click the gear icon (⚙) in the top-right corner, then click "Setup".',
  },
  {
    title: 'Find App Manager',
    detail: 'In the left sidebar, type "App Manager" in the Quick Find search box. Click "App Manager" when it appears.',
  },
  {
    title: 'Create a New Connected App',
    detail: 'Click the "New Connected App" button in the top-right corner of the App Manager page.',
  },
  {
    title: 'Fill in Basic Information',
    detail: 'Enter a Connected App Name (e.g. "Context Layer"), your email address in the Contact Email field. Leave everything else as-is.',
  },
  {
    title: 'Enable OAuth Settings',
    detail: 'Scroll down to the "API (Enable OAuth Settings)" section. Check the box labeled "Enable OAuth Settings".',
  },
  {
    title: 'Set the Callback URL',
    detail: 'In the "Callback URL" field, paste the URL below exactly as shown. This is where Salesforce will send the user after they authorize.',
    callbackUrl: true,
  },
  {
    title: 'Select OAuth Scopes',
    detail: 'Under "Selected OAuth Scopes", add these two scopes by selecting them and clicking "Add": (1) Access and manage your data (api), and (2) Perform requests on your behalf at any time (refresh_token, offline_access).',
  },
  {
    title: 'Save and Wait',
    detail: 'Click "Save". Salesforce will show a warning — click "Continue". It can take 2–10 minutes for the Connected App to become active.',
  },
  {
    title: 'Copy Your Keys',
    detail: 'After saving, click "Manage Consumer Details". You\'ll need to copy two values: the "Consumer Key" (this is your Client ID) and the "Consumer Secret" (this is your Client Secret). Paste both into your API .env file.',
  },
]

export default function SalesforceSetupPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const callbackUrl = `${apiUrl}/api/v1/connectors/salesforce/callback`

  // Check for error passed back from OAuth callback redirect
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/connectors/new"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Connectors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Connect Salesforce</h1>
        <p className="text-gray-500 mt-1">
          Follow these steps to create a Connected App in Salesforce, then click Connect.
          This takes about 5 minutes.
        </p>
      </div>

      {/* Setup steps */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 mb-6">
        {STEPS.map((step, i) => (
          <div key={i} className="p-4 flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 text-sm font-semibold">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{step.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{step.detail}</p>
              {step.callbackUrl && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-700 break-all select-all">
                  {callbackUrl}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Checklist before connecting */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Before clicking Connect</p>
            <ul className="text-sm text-amber-800 mt-1 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                You've created the Connected App and waited for it to activate (2–10 min)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                You've copied the Consumer Key and Consumer Secret into your API <code className="bg-amber-100 px-1 rounded">.env</code> file
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                The API server has been restarted after updating the .env file
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Connect button (client component) */}
      <ConnectSalesforceButton apiUrl={apiUrl} />

      {/* Help link */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <a
          href="https://help.salesforce.com/s/articleView?id=sf.connected_app_create_api_integration.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Salesforce Connected App documentation
        </a>
      </div>
    </div>
  )
}
