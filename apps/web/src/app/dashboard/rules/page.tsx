import { Shield, Plus } from 'lucide-react'

const RULE_TYPE_LABELS: Record<string, string> = {
  filter: 'Filter',
  join: 'Join',
  exclusion: 'Exclusion',
  alias: 'Alias',
  nuance: 'Nuance',
  temporal_change: 'Definition Change',
}

const RULE_TYPE_COLORS: Record<string, string> = {
  filter: 'bg-blue-50 text-blue-700',
  join: 'bg-purple-50 text-purple-700',
  exclusion: 'bg-red-50 text-red-700',
  alias: 'bg-gray-50 text-gray-700',
  nuance: 'bg-yellow-50 text-yellow-700',
  temporal_change: 'bg-orange-50 text-orange-700',
}

export default function RulesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Rules</h1>
          <p className="text-gray-500 mt-1">
            Organizational nuances, filters, and definition changes applied to every AI query
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-DEFAULT text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors">
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {/* Rule type guide */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Object.entries(RULE_TYPE_LABELS).map(([type, label]) => (
          <div key={type} className="bg-white border border-gray-200 rounded-lg p-3">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${RULE_TYPE_COLORS[type]}`}>
              {label}
            </span>
            <p className="text-xs text-gray-500">
              {type === 'filter' && 'Always apply this filter to queries on a metric or object'}
              {type === 'join' && 'How to join this object to another'}
              {type === 'exclusion' && 'Exclude these records from all calculations'}
              {type === 'alias' && 'Alternative name for a metric or field'}
              {type === 'nuance' && 'Organizational context to include with AI responses'}
              {type === 'temporal_change' && 'A definition that changed on a specific date'}
            </p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <Shield className="h-10 w-10 text-gray-300 mx-auto mb-4" />
        <h3 className="font-medium text-gray-700 mb-1">No business rules yet</h3>
        <p className="text-sm text-gray-500 mb-4">
          Add rules like "always exclude Account.Type = Internal" or "MQL definition changed May 2025"
        </p>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-teal-DEFAULT text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors">
          <Plus className="h-4 w-4" />
          Add your first rule
        </button>
      </div>
    </div>
  )
}
